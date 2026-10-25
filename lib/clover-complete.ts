// Website → Clover, part 2: when an online order is marked Completed (on the
// dashboard, or automatically when Uber delivers it), close it out on Clover
// too, so the Clover Orders app shows it as Paid instead of Open.
//
// Website orders are paid through Stripe, not on the Clover device, so Clover
// only knows they're paid if we tell it. We do that the way Clover intends
// for outside payments: record a payment on the order with an "external"
// tender called "Website (Stripe)" (created once, hidden from the register's
// payment buttons). No money moves — it's a bookkeeping entry. Then the
// order is locked, the same as Clover does after a register sale.
//
// Server-only. Safe to call more than once — an order that already has a
// payment on Clover is left alone.
import { supabaseAdmin } from "./supabase-admin";
import { cloverUrls, getFreshCloverConnection, isCloverConfigured } from "./clover";

const TENDER_LABEL = "Website (Stripe)";
const TENDER_KEY = "com.manhattanmarket.website";

export type CloverCompleteResult = { ok: true; skipped?: string } | { ok: false; error: string };

async function cloverFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${cloverUrls().api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "ManhattanMarket/1.0 (www.manhattanmarketdc.com)",
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: res.ok, status: res.status, body };
}

type Tender = { id: string; label?: string; labelKey?: string; enabled?: boolean };

// Finds (or makes, the first time) the "Website (Stripe)" tender.
async function websiteTenderId(mId: string, token: string): Promise<string | null> {
  const list = await cloverFetch(`/v3/merchants/${mId}/tenders?limit=100`, token);
  const tenders = ((list.body as { elements?: Tender[] } | null)?.elements ?? []).filter((t) => t.id);
  const ours = tenders.find((t) => t.labelKey === TENDER_KEY || t.label === TENDER_LABEL);
  if (ours) return ours.id;

  const created = await cloverFetch(`/v3/merchants/${mId}/tenders`, token, {
    method: "POST",
    body: JSON.stringify({
      label: TENDER_LABEL,
      labelKey: TENDER_KEY,
      enabled: true,
      visible: false, // don't add a button to the register's payment screen
      opensCashDrawer: false,
      supportsTipping: false,
    }),
  });
  const newId = (created.body as { id?: string } | null)?.id;
  if (created.ok && newId) return newId;
  console.error("[clover complete] couldn't create tender", { status: created.status, body: created.body });

  // Fall back to Clover's built-in "External Payment" tender if there is one.
  const external = tenders.find((t) => t.labelKey === "com.clover.tender.external_payment");
  return external?.id ?? null;
}

type CloverOrder = {
  id: string;
  total?: number;
  state?: string;
  paymentState?: string;
  lineItems?: { elements?: { price?: number; refunded?: boolean }[] };
  payments?: { elements?: { id: string }[] };
};

export async function completeCloverOrder(orderId: string): Promise<CloverCompleteResult> {
  if (!isCloverConfigured()) return { ok: true, skipped: "Clover isn't configured." };
  const admin = supabaseAdmin;
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing." };

  const { data: order } = await admin
    .from("orders")
    .select("id, clover_order_id, stripe_session_id")
    .eq("id", orderId)
    .maybeSingle<{ id: string; clover_order_id: string | null; stripe_session_id: string | null }>();
  if (!order) return { ok: false, error: "Order not found." };
  if (!order.clover_order_id) return { ok: true, skipped: "Not on Clover." };
  // Only orders actually paid online get marked paid — anything else still
  // needs paying at the register.
  if (!order.stripe_session_id) return { ok: true, skipped: "Not paid online." };

  const conn = await getFreshCloverConnection();
  if (!conn) return { ok: false, error: "Clover isn't connected." };
  const { merchant_id: mId, access_token: token } = conn;
  const path = `/v3/merchants/${mId}/orders/${order.clover_order_id}`;

  const current = await cloverFetch(`${path}?expand=lineItems,payments`, token);
  if (!current.ok) {
    return { ok: false, error: `Couldn't read the order on Clover (HTTP ${current.status}).` };
  }
  const co = current.body as CloverOrder;
  if ((co.payments?.elements?.length ?? 0) > 0 || (co.paymentState ?? "").toUpperCase() === "PAID") {
    return { ok: true, skipped: "Already paid on Clover." };
  }

  // Orders created through the API don't total themselves — add up the lines.
  const lineTotal = (co.lineItems?.elements ?? [])
    .filter((l) => !l.refunded)
    .reduce((sum, l) => sum + (Number(l.price) || 0), 0);
  const amount = co.total && co.total > 0 ? co.total : lineTotal;
  if (amount <= 0) return { ok: false, error: "The Clover order has no items to mark paid." };
  if (!co.total || co.total !== amount) {
    await cloverFetch(path, token, { method: "POST", body: JSON.stringify({ total: amount }) });
  }

  const tenderId = await websiteTenderId(mId, token);
  if (!tenderId) return { ok: false, error: "Couldn't set up the Website payment type on Clover." };

  const pay = await cloverFetch(`${path}/payments`, token, {
    method: "POST",
    body: JSON.stringify({
      tender: { id: tenderId },
      amount,
      result: "SUCCESS",
      externalPaymentId: `WEB-${order.id.slice(0, 8)}`,
      note: "Paid online through the website (Stripe).",
    }),
  });
  if (!pay.ok) {
    console.error("[clover complete] payment record failed", { orderId, status: pay.status, body: pay.body });
    return { ok: false, error: `Clover didn't accept the payment record (HTTP ${pay.status}).` };
  }

  // Close it, the way Clover does after a register sale (best-effort).
  const lock = await cloverFetch(path, token, { method: "POST", body: JSON.stringify({ state: "locked" }) });
  if (!lock.ok) console.error("[clover complete] lock failed", { orderId, status: lock.status, body: lock.body });

  return { ok: true };
}
