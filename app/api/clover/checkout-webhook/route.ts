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

export const runtime = "nodejs";

type Notice = Record<string, unknown>;

// Clover's field names, read case-insensitively to be safe.
function field(n: Notice, name: string): string {
  const key = Object.keys(n).find((k) => k.toLowerCase() === name.toLowerCase());
  const v = key ? n[key] : undefined;
  return typeof v === "string" ? v : v == null ? "" : String(v);
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
  let notice: Notice;
  try {
    notice = JSON.parse(raw) as Notice;
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const admin = supabaseAdmin;
  if (!admin) return NextResponse.json({ error: "not configured" }, { status: 503 });

  const type = field(notice, "type").toUpperCase();
  const status = field(notice, "status").toUpperCase();
  const paymentId = field(notice, "id");
  const checkoutId = field(notice, "data");
  if (type !== "PAYMENT" || !checkoutId) return NextResponse.json({ received: true });

  const { data: pending } = await admin
    .from("pending_checkouts")
    .select("id, status, order_id, payload")
    .eq("id", checkoutId)
    .maybeSingle<Pending>();
  if (!pending) {
    console.warn("[clover checkout webhook] unknown checkout", { checkoutId, status });
    return NextResponse.json({ received: true });
  }

  if (status !== "APPROVED") {
    // A declined card — the customer can try again on Clover's page.
    if (pending.status === "pending") await admin.from("pending_checkouts").update({ status: "declined" }).eq("id", checkoutId);
    return NextResponse.json({ received: true });
  }
  if (pending.order_id) return NextResponse.json({ received: true }); // already done (a retry)

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

  return NextResponse.json({ received: true });
}
