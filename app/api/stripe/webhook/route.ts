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
import { fulfillPaidCheckout, PaidCheckout } from "@/lib/fulfill-order";

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

  // Delivery details captured at checkout (see app/api/checkout/session).
  let delivery: PaidCheckout["delivery"] = null;
  if (meta.delivery) {
    try {
      delivery = JSON.parse(meta.delivery);
    } catch {
      console.error("[stripe webhook] couldn't parse delivery metadata", { sessionId: session.id });
    }
  }

  // Creating the order, stock, staff alerts and Clover all live in
  // lib/fulfill-order.ts (shared with Clover payments).
  await fulfillPaidCheckout(
    {
      cartLines,
      fulfillment: meta.fulfillment === "delivery" ? "delivery" : "pickup",
      phone: meta.phone || null,
      delivery,
      alcohol: meta.alcohol === "1",
      amountTotalCents: typeof session.amount_total === "number" ? session.amount_total : null,
      payment: { provider: "stripe", stripeSessionId: session.id },
    },
    "stripe webhook"
  );
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
