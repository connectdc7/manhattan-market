// Calls an Uber courier for a delivery order — run when staff mark the
// order Ready on the dashboard (app/api/delivery/dispatch). Server-only.
//
// The customer paid the fee Uber quoted at checkout. Quotes expire after a
// few minutes, so a fresh quote is taken here right before booking; if
// Uber's price moved a little since checkout, the store covers the
// difference (the customer is never re-charged).
import { supabaseAdmin } from "./supabase-admin";
import { createUberDelivery, getDeliveryQuote, isUberConfigured, toE164, DeliveryAddress, UberDelivery } from "./uber";
import { isTwilioConfigured, sendSms } from "./twilio";
import type { OrderItem } from "./orders";

type DeliveryOrder = {
  id: string;
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  phone: string | null;
  delivery_address: DeliveryAddress | null;
  uber_delivery_id: string | null;
  uber_status: string | null;
};

export type DispatchResult =
  | { ok: true; deliveryId: string; trackingUrl: string | null; texted: boolean; alreadyDispatched?: boolean }
  | { ok: false; error: string };

async function saveError(orderId: string, message: string) {
  await supabaseAdmin?.from("orders").update({ uber_error: message }).eq("id", orderId);
}

export async function dispatchOrderToUber(orderId: string): Promise<DispatchResult> {
  if (!isUberConfigured()) return { ok: false, error: "Uber delivery isn't set up yet — arrange this delivery yourself." };
  const admin = supabaseAdmin;
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing." };

  const { data: order } = await admin
    .from("orders")
    .select("id, fulfillment, items, phone, delivery_address, uber_delivery_id, uber_status")
    .eq("id", orderId)
    .maybeSingle<DeliveryOrder>();
  if (!order) return { ok: false, error: "Order not found." };
  if (order.fulfillment !== "delivery") return { ok: false, error: "This is a pickup order." };

  // Never book two couriers for one order (double taps, retries).
  if (order.uber_delivery_id && order.uber_status !== "canceled" && order.uber_status !== "returned") {
    return { ok: true, deliveryId: order.uber_delivery_id, trackingUrl: null, texted: false, alreadyDispatched: true };
  }

  const address = order.delivery_address;
  const phone = toE164(order.phone);
  if (!address) {
    const msg = "This order has no delivery address — arrange it yourself.";
    await saveError(orderId, msg);
    return { ok: false, error: msg };
  }
  if (!phone) {
    const msg = "This order has no valid customer phone number — Uber requires one.";
    await saveError(orderId, msg);
    return { ok: false, error: msg };
  }

  const quote = await getDeliveryQuote(address, phone);
  if (!quote.ok) {
    await saveError(orderId, quote.message);
    return { ok: false, error: quote.message };
  }

  const created = await createUberDelivery({
    quoteId: quote.quote.id,
    orderId,
    address,
    phone,
    items: order.items.map((i) => ({ name: i.name, qty: i.qty, price: Number(i.price) })),
  });
  if (!created.ok) {
    await saveError(orderId, created.message);
    return { ok: false, error: created.message };
  }

  const d: UberDelivery = created.delivery;
  await admin
    .from("orders")
    .update({
      uber_delivery_id: d.id,
      uber_status: d.status ?? "pending",
      uber_tracking_url: d.tracking_url ?? null,
      uber_courier: d.courier ?? null,
      uber_error: null,
    })
    .eq("id", orderId);

  // Text the customer their live tracking link (best-effort).
  let texted = false;
  if (isTwilioConfigured() && d.tracking_url) {
    const result = await sendSms(
      phone,
      `Manhattan Market: your order's ready and an Uber courier is on the way to pick it up. Track it here: ${d.tracking_url}`
    );
    texted = result.ok;
  }

  return { ok: true, deliveryId: d.id, trackingUrl: d.tracking_url ?? null, texted };
}
