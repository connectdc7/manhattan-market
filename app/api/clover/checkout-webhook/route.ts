// Where Clover sends Hosted Checkout payment notices (set in the Clover web
// dashboard: Settings → Ecommerce → Hosted Checkout → Webhook URL =
// https://www.manhattanmarketdc.com/api/clover/checkout-webhook). Same job
// as the Stripe webhook: only once Clover confirms the card was charged does
// the order get created (lib/fulfill-order.ts). See lib/clover-checkout.ts.
import { NextResponse } from "next/server";
import { verifyHostedCheckoutSignature } from "@/lib/clover-checkout";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { fulfillPaidCheckout, PaidCheckout } from "@/lib/fulfill-order";
import { isPushConfigured, notifyAllStaff } from "@/lib/push";
import { cloverUrls, getFreshCloverConnection } from "@/lib/clover";

export const runtime = "nodejs";

type Notice = Record<string, unknown>;

// Clover's notice can arrive as one JSON object, a list of them, wrapped in
// another object, or form-encoded — read whatever shape it is, and find
// fields case-insensitively wherever they sit.
function parseNotices(raw: string): Notice[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const form = new URLSearchParams(raw);
    parsed = Object.fromEntries(form.entries());
  }
  const out: Notice[] = [];
  const walk = (v: unknown, depth: number) => {
    if (depth > 3 || v == null) return;
    if (Array.isArray(v)) return v.forEach((x) => walk(x, depth + 1));
    if (typeof v === "object") {
      const n = v as Notice;
      if (Object.keys(n).some((k) => ["status", "type", "data"].includes(k.toLowerCase()))) out.push(n);
      else Object.values(n).forEach((x) => walk(x, depth + 1));
    }
  };
  walk(parsed, 0);
  return out;
}

function field(n: Notice, ...names: string[]): string {
  for (const name of names) {
    const key = Object.keys(n).find((k) => k.toLowerCase() === name.toLowerCase());
    const v = key ? n[key] : undefined;
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return "";
}

// What the payment was for, in cents — used to match a notice that doesn't
// name its checkout session to the checkout that's waiting.
async function cloverPaymentCents(paymentId: string): Promise<number | null> {
  try {
    const conn = await getFreshCloverConnection();
    if (!conn || !paymentId) return null;
    const res = await fetch(`${cloverUrls().api}/v3/merchants/${conn.merchant_id}/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${conn.access_token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { amount?: number };
    return typeof body.amount === "number" ? body.amount : null;
  } catch {
    return null;
  }
}

type Pending = {
  id: string;
  status: string;
  order_id: string | null;
  payload: {
    cart: { id: string; qty: number }[];
    fulfillment: "pickup" | "delivery";
    phone: string;
    delivery: PaidCheckout["delivery"];
    alcohol: boolean;
    totalCents: number;
    promo?: string;
    discountCents?: number;
  };
};

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyHostedCheckoutSignature(raw, request.headers.get("clover-signature"))) {
    console.error("[clover checkout webhook] bad or missing signature");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  const notices = parseNotices(raw);
  const admin = supabaseAdmin;
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });
  if (notices.length === 0) {
    console.warn("[clover checkout webhook] couldn't read the notice", { body: raw.slice(0, 300) });
    return NextResponse.json({ received: true });
  }
  for (const notice of notices) await handleNotice(admin, notice);
  return NextResponse.json({ received: true });
}

async function handleNotice(admin: NonNullable<typeof supabaseAdmin>, notice: Notice) {
  const type = field(notice, "type").toUpperCase();
  const status = field(notice, "status").toUpperCase();
  const paymentId = field(notice, "id", "paymentId");
  const checkoutIdRaw = field(notice, "data", "checkoutSessionId", "checkoutId");
  // Logged on purpose (no card details are in it) so a mismatch is easy to see in Vercel's logs.
  console.log("[clover checkout webhook] notice", { keys: Object.keys(notice), type, status, paymentId, checkoutId: checkoutIdRaw });
  if (type && type !== "PAYMENT") return;

  let { data: pending } = await admin
    .from("pending_checkouts")
    .select("id, status, order_id, payload")
    .eq("id", checkoutIdRaw || "-")
    .maybeSingle<Pending>();
  if (!pending && status === "APPROVED" && paymentId) {
    // Notice didn't name a checkout we know — match by amount to the
    // newest unpaid checkout from the last 2 hours.
    const cents = await cloverPaymentCents(paymentId);
    const since = new Date(Date.now() - 2 * 3600_000).toISOString();
    const { data: candidates } = await admin
      .from("pending_checkouts")
      .select("id, status, order_id, payload")
      .eq("status", "pending")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20);
    pending = ((candidates ?? []) as Pending[]).find((c) => cents !== null && c.payload?.totalCents === cents) ?? null;
    console.warn("[clover checkout webhook] matched by amount", { paymentId, cents, matched: pending?.id ?? null });
  }
  if (!pending) {
    console.warn("[clover checkout webhook] unknown checkout", { checkoutId: checkoutIdRaw, paymentId, status });
    return;
  }
  const checkoutId = pending.id;

  if (status !== "APPROVED") {
    // A declined card — the customer can try again on Clover's page.
    if (pending.status === "pending") await admin.from("pending_checkouts").update({ status: "declined" }).eq("id", checkoutId);
    return;
  }
  if (pending.order_id) return; // already done (a retry)

  const p = pending.payload;
  const orderId = await fulfillPaidCheckout(
    {
      cartLines: p.cart ?? [],
      fulfillment: p.fulfillment === "delivery" ? "delivery" : "pickup",
      phone: p.phone || null,
      delivery: p.delivery ?? null,
      alcohol: Boolean(p.alcohol),
      discount: p.promo ? { code: p.promo, cents: Number(p.discountCents) || 0 } : null,
      amountTotalCents: typeof p.totalCents === "number" ? p.totalCents : null,
      payment: { provider: "clover", checkoutId, paymentId },
    },
    "clover checkout webhook"
  );

  // Look up the order id even on a retry where fulfill returned null.
  let finalOrderId = orderId;
  if (!finalOrderId) {
    const { data: existing } = await admin.from("orders").select("id").eq("clover_checkout_id", checkoutId).maybeSingle();
    finalOrderId = (existing?.id as string | undefined) ?? null;
  }
  if (!finalOrderId) {
    // Paid, but the cart couldn't be turned into an order (e.g. products
    // removed meanwhile). Make sure a human sees it.
    console.error("[clover checkout webhook] PAID but no order created", { checkoutId, paymentId });
    if (isPushConfigured()) {
      await notifyAllStaff({
        title: "Online payment needs attention",
        body: "A customer paid through Clover but the order couldn't be created. Check Clover transactions.",
        tag: `pay-${checkoutId}`,
      }).catch(() => {});
    }
  }
  await admin
    .from("pending_checkouts")
    .update({ status: "paid", payment_id: paymentId, order_id: finalOrderId })
    .eq("id", checkoutId);
}
