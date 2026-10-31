// Website → Clover: sends a website order to the store's Clover account so
// it shows up on the Clover device (Orders app) and prints on the default
// order printer, and lowers Clover's stock counts for what was sold.
//
// Server-only (uses the service role key + Clover access token). Called
// automatically from the Stripe webhook once an online order is paid, and
// from the dashboard's "Send to Clover" button (app/api/clover/push-order)
// for retries or for orders placed before Clover was connected.
//
// Needs the Clover app to have these permissions (Clover Developer
// Dashboard → your app → Requested Permissions): Read + Write Inventory,
// Read + Write Orders. If you add a permission after connecting, click
// Disconnect then Connect Clover again so the new permission takes effect.
import { supabaseAdmin } from "./supabase-admin";
import { cloverUrls, getFreshCloverConnection, isCloverConfigured } from "./clover";
import type { OrderItem } from "./orders";

export type CloverPushResult =
  | { ok: true; cloverOrderId: string; printed: boolean; stockUpdated: number }
  | { ok: false; error: string };

type OrderRow = {
  id: string;
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  subtotal: number;
  phone: string | null;
  stripe_session_id: string | null;
  clover_payment_id?: string | null;
  clover_order_id: string | null;
  delivery_address: { name?: string; street?: string; apt?: string; city?: string } | null;
};

async function cloverFetch(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${cloverUrls().api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
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

async function recordResult(orderId: string, fields: { clover_order_id?: string | null; clover_push_error?: string | null }) {
  await supabaseAdmin?.from("orders").update(fields).eq("id", orderId);
}

export async function pushOrderToClover(orderId: string): Promise<CloverPushResult> {
  if (!isCloverConfigured()) return { ok: false, error: "Clover isn't configured yet." };
  const admin = supabaseAdmin;
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing." };

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, fulfillment, items, subtotal, phone, stripe_session_id, clover_payment_id, clover_order_id, delivery_address")
    .eq("id", orderId)
    .maybeSingle<OrderRow>();
  if (orderError || !order) return { ok: false, error: "Order not found." };

  // Wine/beer flag (supabase/alcohol.sql) — read separately so an older
  // database without the column still pushes orders fine.
  const { data: alcoholRow } = await admin.from("orders").select("contains_alcohol").eq("id", orderId).maybeSingle();
  const containsAlcohol = Boolean((alcoholRow as { contains_alcohol?: boolean } | null)?.contains_alcohol);
  // Welcome-offer discount (supabase/welcome-offer.sql), read the same way.
  const { data: discountRow } = await admin.from("orders").select("discount_code, discount_amount").eq("id", orderId).maybeSingle();
  const discount = discountRow as { discount_code?: string | null; discount_amount?: number | null } | null;
  const discountCents = discount?.discount_code ? Math.round(Number(discount.discount_amount ?? 0) * 100) : 0;

  // Never create the same order on Clover twice (Stripe retries, double-clicks).
  if (order.clover_order_id) {
    return { ok: true, cloverOrderId: order.clover_order_id, printed: false, stockUpdated: 0 };
  }

  const connection = await getFreshCloverConnection();
  if (!connection) return { ok: false, error: "Clover isn't connected." };
  const { merchant_id: mId, access_token: token } = connection;

  // Which website products are linked to Clover items (from Sync Now).
  const productIds = order.items.map((i) => i.id);
  const { data: productRows } = await admin.from("products").select("id, clover_item_id").in("id", productIds);
  const cloverIdFor = new Map<string, string>();
  for (const row of productRows ?? []) {
    if (row.clover_item_id) cloverIdFor.set(row.id, row.clover_item_id);
  }

  const paidByClover = Boolean(order.clover_payment_id);
  const paid = Boolean(order.stripe_session_id) || paidByClover;
  const shortId = order.id.slice(0, 6).toUpperCase();

  // Paid through Clover Hosted Checkout: Clover already made an order for
  // that payment. Use it (rename + note + print) instead of a second one.
  let existingCloverOrderId: string | null = null;
  if (paidByClover) {
    const payment = await cloverFetch(`/v3/merchants/${mId}/payments/${order.clover_payment_id}?expand=order`, token);
    existingCloverOrderId = (payment.body as { order?: { id?: string } } | null)?.order?.id ?? null;
    if (!existingCloverOrderId) {
      // Never make a second, unpaid copy of a sale Clover already has — staff
      // can't complete it without charging again. Usually this means the
      // Clover API token is missing the "Payments: Read" permission.
      console.error("[clover] no order found for Clover payment", { orderId, status: payment.status, body: payment.body });
      const error =
        payment.status === 401 || payment.status === 403
          ? "Clover wouldn't share this payment — give the website's Clover API token the Payments (Read) permission, then tap Send to Clover."
          : `Couldn't find Clover's order for this payment (HTTP ${payment.status}). It's paid — look it up in Clover → Transactions.`;
      await recordResult(orderId, { clover_push_error: error });
      return { ok: false, error };
    }
  }

  // 1. Create the order shell (or update Clover's own one).
  const created = await cloverFetch(existingCloverOrderId ? `/v3/merchants/${mId}/orders/${existingCloverOrderId}` : `/v3/merchants/${mId}/orders`, token, {
    method: "POST",
    body: JSON.stringify({
      ...(existingCloverOrderId ? {} : { state: "open" }),
      title: `WEB #${shortId} · ${order.fulfillment === "delivery" ? "DELIVERY" : "PICKUP"}${containsAlcohol ? " · 21+ ID" : ""}`,
      note: [
        containsAlcohol ? "*** CONTAINS ALCOHOL — CHECK PHOTO ID (21+) BEFORE HANDING OVER ***" : null,
        paid
          ? `PAID ONLINE (website / ${paidByClover ? "Clover card payment" : "Stripe"}) — do NOT charge again.`
          : "Website order — NOT paid online, collect payment.",
        order.phone ? `Customer phone: ${order.phone}` : null,
        order.delivery_address
          ? `Deliver to: ${order.delivery_address.name ?? ""}, ${order.delivery_address.street ?? ""}${order.delivery_address.apt ? ` ${order.delivery_address.apt}` : ""} (Uber courier)`
          : null,
        discountCents > 0 ? `Welcome offer ${discount!.discount_code}: -$${(discountCents / 100).toFixed(2)}` : null,
        `Website total: $${Number(order.subtotal).toFixed(2)}`,
      ]
        .filter(Boolean)
        .join("\n"),
    }),
  });
  const cloverOrderId = existingCloverOrderId ?? (created.body as { id?: string } | null)?.id;
  if (!created.ok || !cloverOrderId) {
    const error = `Clover rejected the order (HTTP ${created.status}).${created.status === 401 || created.status === 403 ? " Check the app has Write Orders permission, then reconnect." : ""}`;
    console.error("[clover] create order failed", { orderId, status: created.status, body: created.body });
    await recordResult(orderId, { clover_push_error: error });
    return { ok: false, error };
  }

  // Save the link right away, so a failure below can't lead to a duplicate
  // order on Clover if someone retries.
  await recordResult(orderId, { clover_order_id: cloverOrderId, clover_push_error: null });

  // 2. Line items — Clover uses one line item per unit sold. (Clover's own
  //    order for a Clover payment already has them.)
  const lineItems = order.items.flatMap((item) => {
    const cloverItemId = cloverIdFor.get(item.id);
    const line = {
      name: item.name,
      price: Math.round(Number(item.price) * 100),
      ...(cloverItemId ? { item: { id: cloverItemId } } : {}),
    };
    return Array.from({ length: Math.max(1, Math.min(item.qty, 50)) }, () => line);
  });
  const lines = existingCloverOrderId
    ? { ok: true, status: 200, body: null }
    : await cloverFetch(`/v3/merchants/${mId}/orders/${cloverOrderId}/bulk_line_items`, token, {
        method: "POST",
        body: JSON.stringify({ items: lineItems }),
      });
  if (!lines.ok) {
    console.error("[clover] add line items failed", { orderId, status: lines.status, body: lines.body });
    const error = `Order created on Clover but items failed to add (HTTP ${lines.status}).`;
    await recordResult(orderId, { clover_push_error: error });
    return { ok: false, error };
  }

  // 2b. Welcome offer: an order discount, so Clover's total matches what the
  //     customer paid. (A Clover-paid order already has it in its prices.)
  if (discountCents > 0 && !existingCloverOrderId) {
    const d = await cloverFetch(`/v3/merchants/${mId}/orders/${cloverOrderId}/discounts`, token, {
      method: "POST",
      body: JSON.stringify({ name: `Welcome offer (${discount!.discount_code})`, amount: -discountCents }),
    });
    if (!d.ok) console.error("[clover] add discount failed", { orderId, status: d.status, body: d.body });
  }

  // 3. Print it on the store's order printer (best-effort).
  const print = await cloverFetch(`/v3/merchants/${mId}/print_event`, token, {
    method: "POST",
    body: JSON.stringify({ orderRef: { id: cloverOrderId } }),
  });
  if (!print.ok) console.error("[clover] print_event failed", { orderId, status: print.status, body: print.body });

  // 4. Lower Clover's stock for linked items (Clover doesn't do this itself
  //    for orders created through the API). Clover then sends its usual
  //    inventory webhook, which keeps the website's count in step.
  let stockUpdated = 0;
  for (const item of order.items) {
    const cloverItemId = cloverIdFor.get(item.id);
    if (!cloverItemId) continue;
    const current = await cloverFetch(`/v3/merchants/${mId}/item_stocks/${cloverItemId}`, token);
    const qty = (current.body as { quantity?: number } | null)?.quantity;
    if (!current.ok || typeof qty !== "number") continue; // item not stock-tracked in Clover
    const updated = await cloverFetch(`/v3/merchants/${mId}/item_stocks/${cloverItemId}`, token, {
      method: "PUT",
      body: JSON.stringify({ quantity: Math.max(0, qty - item.qty) }),
    });
    if (updated.ok) stockUpdated++;
    else console.error("[clover] stock update failed", { cloverItemId, status: updated.status, body: updated.body });
  }

  return { ok: true, cloverOrderId, printed: print.ok, stockUpdated };
}
