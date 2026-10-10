// Where Stripe sends payment notifications, once this URL is registered in
// the Stripe Dashboard (Developers -> Webhooks) and STRIPE_WEBHOOK_SECRET
// is set. This is what actually creates the order and decrements stock —
// not the browser — so an order only ever gets recorded once Stripe
// confirms the card was really charged, the same "don't trust the client"
// principle as app/api/checkout/session/route.ts pricing everything itself.
//
// Always responds 200 for anything it recognizes and safely no-ops on —
// Stripe retries (with backoff, for up to three days) on anything else, and
// a shopper never sees this response either way.
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProducts } from "@/lib/products";
import { createOrderAdmin, decrementStockAdmin } from "@/lib/orders-admin";
import { pushOrderToClover } from "@/lib/clover-orders";
import { isCloverConfigured } from "@/lib/clover";

export const runtime = "nodejs";

async function fulfillCheckoutSession(session: Stripe.Checkout.Session) {
  const meta = session.metadata ?? {};

  let cartLines: { id: string; qty: number }[] = [];
  try {
    cartLines = JSON.parse(meta.cart || "[]");
  } catch {
    console.error("[stripe webhook] couldn't parse cart metadata", { sessionId: session.id });
    return;
  }
  if (cartLines.length === 0) return;

  // Re-derive name/price from the current product list rather than trusting
  // anything from the session — mirrors how the session was priced in the
  // first place (see app/api/checkout/session/route.ts).
  const products = await getProducts();
  const items = cartLines
    .map((line) => {
      const product = products.find((p) => p.id === line.id);
      if (!product) return null;
      return { id: product.id, name: product.name, price: product.price, qty: line.qty };
    })
    .filter((item): item is { id: string; name: string; price: number; qty: number } => item !== null);
  if (items.length === 0) return;

  // Delivery details captured at checkout (see app/api/checkout/session).
  let delivery: { name: string; street: string; apt?: string; city: string; state: string; zip: string; notes?: string; fee?: number; service?: number } | null = null;
  if (meta.delivery) {
    try {
      delivery = JSON.parse(meta.delivery);
    } catch {
      console.error("[stripe webhook] couldn't parse delivery metadata", { sessionId: session.id });
    }
  }
  const deliveryFee = Number(delivery?.fee ?? 0) || 0;
  const serviceFee = Number(delivery?.service ?? 0) || 0;

  // Items only — the delivery fee is stored separately so sales numbers
  // aren't inflated by what goes to Uber.
  const subtotal =
    typeof session.amount_total === "number"
      ? Math.max(0, session.amount_total / 100 - deliveryFee - serviceFee)
      : items.reduce((sum, item) => sum + item.price * item.qty, 0);

  const createdId = await createOrderAdmin({
    fulfillment: meta.fulfillment === "delivery" ? "delivery" : "pickup",
    items,
    subtotal,
    phone: meta.phone || null,
    stripe_session_id: session.id,
    delivery_address: delivery
      ? {
          name: delivery.name,
          street: delivery.street,
          apt: delivery.apt ?? "",
          city: delivery.city,
          state: delivery.state,
          zip: delivery.zip,
          notes: delivery.notes ?? "",
        }
      : null,
    delivery_fee: delivery ? deliveryFee : null,
    service_fee: delivery && serviceFee > 0 ? serviceFee : null,
  });

  // Only touch stock the first time this session is fulfilled — createOrderAdmin
  // returns false on a Stripe retry for a session already recorded (see its
  // own comment), which keeps a redelivered webhook from double-decrementing.
  if (createdId) {
    await decrementStockAdmin(cartLines);

    // Send it to the Clover device/printer and lower Clover's stock. Best-
    // effort: a Clover hiccup must never fail the webhook (the order is
    // already saved and paid) — staff can retry with "Send to Clover" on
    // the dashboard, which shows the error.
    if (isCloverConfigured()) {
      try {
        const result = await pushOrderToClover(createdId);
        if (!result.ok) console.error("[stripe webhook] Clover push failed", { orderId: createdId, error: result.error });
      } catch (err) {
        console.error("[stripe webhook] Clover push threw", err);
      }
    }
  }
}

export async function POST(request: Request) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ received: true });
  }

  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const body = await request.text();

  let event: Stripe.Event;
  try {
    if (!signature || !webhookSecret) throw new Error("missing signature header or STRIPE_WEBHOOK_SECRET");
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe webhook] signature verification failed", err);
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.payment_status === "paid") {
      await fulfillCheckoutSession(session);
    }
  }

  return NextResponse.json({ received: true });
}
