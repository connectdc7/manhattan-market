// Turns a confirmed online payment into a real order — shared by the Stripe
// webhook (app/api/stripe/webhook) and the Clover Hosted Checkout webhook
// (app/api/clover/checkout-webhook). Server-only.
//
// Records the order (once — retries are ignored), flags wine/beer, lowers
// stock, alerts staff phones, and sends it to the Clover device/printer.
import { getProductsByIds } from "./products";
import { createOrderAdmin, decrementStockAdmin } from "./orders-admin";
import { supabaseAdmin } from "./supabase-admin";
import { pushOrderToClover } from "./clover-orders";
import { isPushConfigured, notifyAllStaff } from "./push";
import { isCloverConfigured } from "./clover";

export type PaidCheckout = {
  cartLines: { id: string; qty: number }[];
  fulfillment: "pickup" | "delivery";
  phone: string | null;
  delivery: {
    name: string;
    street: string;
    apt?: string;
    city: string;
    state: string;
    zip: string;
    notes?: string;
    fee?: number;
    service?: number;
  } | null;
  alcohol: boolean;
  amountTotalCents: number | null; // what the customer actually paid, if known
  payment:
    | { provider: "stripe"; stripeSessionId: string }
    | { provider: "clover"; checkoutId: string; paymentId: string };
};

// Returns the new order id, or null if nothing was created (already
// recorded, or the cart couldn't be read).
export async function fulfillPaidCheckout(c: PaidCheckout, logTag: string): Promise<string | null> {
  if (c.cartLines.length === 0) return null;

  // Re-derive name/price from the current product list rather than trusting
  // anything passed around during checkout.
  const products = await getProductsByIds(c.cartLines.map((l) => l.id));
  const items = c.cartLines
    .map((line) => {
      const product = products.find((p) => p.id === line.id);
      if (!product) return null;
      return { id: product.id, name: product.name, price: product.price, qty: line.qty };
    })
    .filter((item): item is { id: string; name: string; price: number; qty: number } => item !== null);
  if (items.length === 0) return null;

  const deliveryFee = Number(c.delivery?.fee ?? 0) || 0;
  const serviceFee = Number(c.delivery?.service ?? 0) || 0;
  // Items only — fees are stored separately so sales numbers aren't inflated.
  const subtotal =
    typeof c.amountTotalCents === "number"
      ? Math.max(0, c.amountTotalCents / 100 - deliveryFee - serviceFee)
      : items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const createdId = await createOrderAdmin({
    fulfillment: c.fulfillment,
    items,
    subtotal,
    phone: c.phone || null,
    ...(c.payment.provider === "stripe"
      ? { stripe_session_id: c.payment.stripeSessionId, payment_provider: "stripe" as const }
      : {
          payment_provider: "clover" as const,
          clover_checkout_id: c.payment.checkoutId,
          clover_payment_id: c.payment.paymentId,
        }),
    delivery_address: c.delivery
      ? {
          name: c.delivery.name,
          street: c.delivery.street,
          apt: c.delivery.apt ?? "",
          city: c.delivery.city,
          state: c.delivery.state,
          zip: c.delivery.zip,
          notes: c.delivery.notes ?? "",
        }
      : null,
    delivery_fee: c.delivery ? deliveryFee : null,
    service_fee: c.delivery && serviceFee > 0 ? serviceFee : null,
  });
  // null = a retry for a payment that was already recorded — do nothing more.
  if (!createdId) return null;

  if (c.alcohol) {
    const { error } = (await supabaseAdmin?.from("orders").update({ contains_alcohol: true }).eq("id", createdId)) ?? {};
    if (error) console.error(`[${logTag}] couldn't flag alcohol order`, error.message);
  }
  await decrementStockAdmin(c.cartLines);

  if (isPushConfigured()) {
    try {
      const count = items.reduce((n, i) => n + i.qty, 0);
      const total = typeof c.amountTotalCents === "number" ? c.amountTotalCents / 100 : subtotal + deliveryFee + serviceFee;
      await notifyAllStaff({
        title: `New ${c.fulfillment === "delivery" ? "delivery" : "pickup"} order · $${total.toFixed(2)}`,
        body: `${count} item${count === 1 ? "" : "s"} · #${createdId.slice(0, 6).toUpperCase()}${c.alcohol ? " · 21+ check ID" : ""}`,
        url: "/dashboard",
        tag: `order-${createdId}`,
      });
    } catch (err) {
      console.error(`[${logTag}] staff alert failed`, err);
    }
  }

  // Best-effort: a Clover hiccup must never fail the webhook — staff can
  // retry with "Send to Clover" on the dashboard, which shows the error.
  if (isCloverConfigured()) {
    try {
      const result = await pushOrderToClover(createdId);
      if (!result.ok) console.error(`[${logTag}] Clover push failed`, { orderId: createdId, error: result.error });
    } catch (err) {
      console.error(`[${logTag}] Clover push threw`, err);
    }
  }
  return createdId;
}
