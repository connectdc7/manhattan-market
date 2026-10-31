// Refunds an online order from the dashboard (owner only — see
// app/api/orders/refund). Server-only.
//
// One click does everything a refund needs:
//   1. Refunds the customer's card through Stripe (the whole order, or just
//      the items picked).
//   2. Clover: a full refund deletes the website's order there (so it stops
//      counting in sales and staff don't make it); a partial refund adds a
//      note to it saying what was refunded.
//   3. Puts the refunded items back in stock — in Clover and on the site.
//   4. Full refund of a delivery order: cancels the Uber courier if they
//      haven't picked it up yet.
//   5. Records the refund on the order (supabase/refunds.sql).
import { supabaseAdmin } from "./supabase-admin";
import { stripe, isStripeConfigured } from "./stripe";
import { cloverUrls, getFreshCloverConnection, isCloverConfigured } from "./clover";
import { cancelUberDelivery, isUberConfigured } from "./uber";
import { refundCloverPayment } from "./clover-checkout";
import type { OrderItem } from "./orders";

export type RefundRequest = {
  orderId: string;
  // Omit (or empty) for a full refund; otherwise the items and quantities to refund.
  items?: { id: string; qty: number }[];
  // Partial refunds only: also refund the delivery + service fee.
  includeFees?: boolean;
};

export type RefundResult =
  | { ok: true; amount: number; full: boolean; notes: string[] }
  | { ok: false; error: string };

type RefundOrder = {
  id: string;
  items: OrderItem[];
  fulfillment: "pickup" | "delivery";
  stripe_session_id: string | null;
  clover_payment_id: string | null;
  subtotal: number;
  clover_order_id: string | null;
  delivery_fee: number | null;
  service_fee: number | null;
  tax_amount?: number | null;
  uber_delivery_id: string | null;
  uber_status: string | null;
  refunded_amount: number | null;
  refunded_items: { id: string; qty: number }[] | null;
  refund_status: string | null;
};

async function cloverCall(path: string, token: string, init: RequestInit = {}) {
  const res = await fetch(`${cloverUrls().api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // empty body (e.g. DELETE)
  }
  return { ok: res.ok, status: res.status, body };
}

const cents = (n: number) => Math.round(n * 100);

export async function refundOrder(req: RefundRequest): Promise<RefundResult> {
  const admin = supabaseAdmin;
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing." };

  const { data: order, error: readError } = await admin
    .from("orders")
    .select(
      "id, items, fulfillment, subtotal, stripe_session_id, clover_payment_id, clover_order_id, delivery_fee, service_fee, uber_delivery_id, uber_status, refunded_amount, refunded_items, refund_status, tax_amount"
    )
    .eq("id", req.orderId)
    .maybeSingle<RefundOrder>();
  if (readError) {
    const hint = /refund/i.test(readError.message) ? " Run supabase/refunds.sql in Supabase first." : "";
    return { ok: false, error: `Couldn't read the order.${hint}` };
  }
  if (!order) return { ok: false, error: "Order not found." };
  const paidByClover = Boolean(order.clover_payment_id);
  if (!order.stripe_session_id && !paidByClover) {
    return { ok: false, error: "This order wasn't paid online, so there's nothing to refund by card." };
  }
  if (order.refund_status === "full") return { ok: false, error: "This order has already been fully refunded." };

  // What's already been refunded, per product.
  const already = new Map<string, number>();
  for (const r of order.refunded_items ?? []) already.set(r.id, (already.get(r.id) ?? 0) + r.qty);

  const full = !req.items || req.items.length === 0;

  // Items being refunded now (capped at what hasn't been refunded yet).
  const refundLines: { id: string; name: string; qty: number; price: number }[] = [];
  for (const item of order.items) {
    const left = item.qty - (already.get(item.id) ?? 0);
    if (left <= 0) continue;
    const wanted = full ? left : Math.min(left, Math.max(0, Math.floor(req.items!.find((i) => i.id === item.id)?.qty ?? 0)));
    if (wanted > 0) refundLines.push({ id: item.id, name: item.name, qty: wanted, price: Number(item.price) });
  }
  if (!full && refundLines.length === 0) return { ok: false, error: "Pick at least one item to refund." };

  let amountCents: number | undefined;
  if (!full) {
    const fees = req.includeFees ? (order.delivery_fee ?? 0) + (order.service_fee ?? 0) : 0;
    const itemCents = refundLines.reduce((s, l) => s + cents(l.price) * l.qty, 0);
    // The sales tax on those items comes back too, in proportion.
    const taxShare = order.tax_amount && Number(order.subtotal) > 0 ? Math.round((itemCents * Number(order.tax_amount)) / Number(order.subtotal)) : 0;
    amountCents = itemCents + taxShare + cents(fees);
  }
  const idempotencyKey = `refund-${order.id}-${full ? "full" : JSON.stringify(refundLines.map((l) => [l.id, l.qty]))}-${Number(order.refunded_amount ?? 0)}`;

  let refundedCents = 0;
  if (paidByClover) {
    // 1a. Clover Hosted Checkout payment.
    let cloverAmount = amountCents;
    if (full && Number(order.refunded_amount ?? 0) > 0) {
      // Whatever hasn't been refunded yet.
      const paidTotal = Number(order.subtotal) + (order.delivery_fee ?? 0) + (order.service_fee ?? 0) + Number(order.tax_amount ?? 0);
      cloverAmount = Math.max(0, cents(paidTotal) - cents(Number(order.refunded_amount)));
    }
    const r = await refundCloverPayment(order.clover_payment_id!, cloverAmount, idempotencyKey);
    if (!r.ok) return { ok: false, error: r.error };
    refundedCents = r.amountCents;
    if (!refundedCents && full) {
      refundedCents = cents(Number(order.subtotal) + (order.delivery_fee ?? 0) + (order.service_fee ?? 0) + Number(order.tax_amount ?? 0));
    }
  } else {
    // 1b. Stripe.
    if (!isStripeConfigured() || !stripe) return { ok: false, error: "Stripe isn't set up." };
    let paymentIntentId: string | null = null;
    try {
      const session = await stripe.checkout.sessions.retrieve(order.stripe_session_id!);
      paymentIntentId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id ?? null;
    } catch (err) {
      console.error("[refund] session retrieve failed", err);
    }
    if (!paymentIntentId) return { ok: false, error: "Couldn't find the Stripe payment for this order." };
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, ...(amountCents ? { amount: amountCents } : {}), reason: "requested_by_customer" },
        { idempotencyKey }
      );
      refundedCents = refund.amount;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[refund] stripe refund failed", msg);
      return { ok: false, error: `Stripe couldn't refund it: ${msg}` };
    }
  }
  const amount = refundedCents / 100;
  const notes: string[] = [`Refunded $${amount.toFixed(2)} to the customer's card.`];

  // 2 + 3. Clover and stock (best-effort — the money is already refunded).
  const { data: productRows } = await admin.from("products").select("id, stock, clover_item_id").in("id", refundLines.map((l) => l.id));
  const productById = new Map((productRows ?? []).map((p) => [p.id as string, p as { id: string; stock: number; clover_item_id: string | null }]));

  if (isCloverConfigured()) {
    const conn = await getFreshCloverConnection();
    if (conn) {
      const mId = conn.merchant_id;
      if (order.clover_order_id) {
        if (full && paidByClover) {
          // The refund already shows on this order in Clover — keep it, just label it.
          await cloverCall(`/v3/merchants/${mId}/orders/${order.clover_order_id}`, conn.access_token, {
            method: "POST",
            body: JSON.stringify({ note: `FULLY REFUNDED ONLINE $${amount.toFixed(2)}.` }),
          });
          notes.push("Marked the order as refunded in Clover.");
        } else if (full) {
          const del = await cloverCall(`/v3/merchants/${mId}/orders/${order.clover_order_id}`, conn.access_token, { method: "DELETE" });
          if (del.ok) {
            notes.push("Removed the order from Clover.");
          } else {
            // Already closed out as Paid on Clover (lib/clover-complete.ts) —
            // Clover may refuse to delete it, so label it instead.
            await cloverCall(`/v3/merchants/${mId}/orders/${order.clover_order_id}`, conn.access_token, {
              method: "POST",
              body: JSON.stringify({ note: `FULLY REFUNDED ONLINE $${amount.toFixed(2)} (Stripe) — not a sale.` }),
            });
            notes.push(`Couldn't remove it from Clover (HTTP ${del.status}) — added a "fully refunded" note; refund or delete it on the Clover device so it stops counting as a sale.`);
          }
        } else {
          const cur = await cloverCall(`/v3/merchants/${mId}/orders/${order.clover_order_id}`, conn.access_token);
          const oldNote = ((cur.body as { note?: string } | null)?.note ?? "").trim();
          const line = `REFUNDED $${amount.toFixed(2)} online: ${refundLines.map((l) => `${l.name} ×${l.qty}`).join(", ")}${req.includeFees ? " + fees" : ""}`;
          await cloverCall(`/v3/merchants/${mId}/orders/${order.clover_order_id}`, conn.access_token, {
            method: "POST",
            body: JSON.stringify({ note: [oldNote, line].filter(Boolean).join("\n").slice(0, 2000) }),
          });
          notes.push("Added a refund note to the order in Clover.");
        }
      }
      // Restock in Clover (only items Clover tracks stock for).
      let restocked = 0;
      for (const l of refundLines) {
        const cid = productById.get(l.id)?.clover_item_id;
        if (!cid) continue;
        const cur = await cloverCall(`/v3/merchants/${mId}/item_stocks/${cid}`, conn.access_token);
        const qty = (cur.body as { quantity?: number } | null)?.quantity;
        if (!cur.ok || typeof qty !== "number") continue;
        const upd = await cloverCall(`/v3/merchants/${mId}/item_stocks/${cid}`, conn.access_token, {
          method: "PUT",
          body: JSON.stringify({ quantity: qty + l.qty }),
        });
        if (upd.ok) restocked++;
      }
      if (restocked) notes.push(`Put ${restocked} item${restocked === 1 ? "" : "s"} back in stock in Clover.`);
    }
  }
  // Site stock, so it shows right away (the next Clover sync agrees with it).
  for (const l of refundLines) {
    const p = productById.get(l.id);
    if (p) await admin.from("products").update({ stock: Math.max(0, Number(p.stock) + l.qty) }).eq("id", p.id);
  }

  // 4. Uber — full refunds of deliveries not yet picked up.
  if (full && isUberConfigured() && order.uber_delivery_id && (order.uber_status === "pending" || order.uber_status === "pickup")) {
    const c = await cancelUberDelivery(order.uber_delivery_id);
    notes.push(c.ok ? "Canceled the Uber courier." : `Couldn't cancel the Uber courier: ${c.message ?? "unknown error"} — cancel it in Uber Direct.`);
    if (c.ok) await admin.from("orders").update({ uber_status: "canceled" }).eq("id", order.id);
  }

  // 5. Record it.
  const mergedItems = [...(order.refunded_items ?? []), ...refundLines.map((l) => ({ id: l.id, qty: l.qty }))];
  const everythingRefunded = order.items.every(
    (it) => mergedItems.filter((r) => r.id === it.id).reduce((s, r) => s + r.qty, 0) >= it.qty
  );
  const { error: saveError } = await admin
    .from("orders")
    .update({
      refunded_amount: Math.round((Number(order.refunded_amount ?? 0) + amount) * 100) / 100,
      refunded_items: mergedItems,
      refund_status: full || everythingRefunded ? "full" : "partial",
      refunded_at: new Date().toISOString(),
      ...(full ? { status: "completed" } : {}),
    })
    .eq("id", order.id);
  if (saveError) {
    console.error("[refund] couldn't record refund", saveError.message);
    notes.push("Note: the refund went through but couldn't be saved on the order — run supabase/refunds.sql.");
  }

  return { ok: true, amount, full, notes };
}
