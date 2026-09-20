// Starts (POST) or checks the status of (GET) a Stripe Checkout session.
//
// POST is called by app/checkout/page.tsx when "Place Order" is clicked.
// If Stripe isn't configured yet, it responds { mock: true } instead of an
// error — the checkout page then falls back to the old instant mocked
// order, the same graceful-degradation pattern used everywhere else in this
// project (Clover, Twilio, the AI photo reader). Once STRIPE_SECRET_KEY is
// set, every checkout goes through real Stripe Checkout.
//
// Prices are always looked up server-side from the product list (Supabase,
// or the local fallback catalog) rather than trusted from the request body
// — the cart in the browser only ever supplies product ids and quantities.
import { NextResponse } from "next/server";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { getProducts } from "@/lib/products";

type RequestLine = { id: string; qty: number };

export async function POST(request: Request) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ mock: true });
  }

  let body: { items?: RequestLine[]; fulfillment?: "pickup" | "delivery"; phone?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const requestedLines = (body.items ?? []).filter(
    (line) => line && typeof line.id === "string" && Number.isFinite(line.qty) && line.qty > 0
  );
  if (requestedLines.length === 0) {
    return NextResponse.json({ error: "Your cart is empty." }, { status: 400 });
  }
  const fulfillment = body.fulfillment === "delivery" ? "delivery" : "pickup";

  const products = await getProducts();
  const lineItems: { name: string; unitAmount: number; qty: number }[] = [];

  for (const line of requestedLines) {
    const product = products.find((p) => p.id === line.id);
    if (!product) {
      return NextResponse.json({ error: "One of the items in your cart is no longer available." }, { status: 409 });
    }
    if (line.qty > product.stock) {
      return NextResponse.json(
        { error: `Only ${product.stock} of "${product.name}" left — update your cart and try again.` },
        { status: 409 }
      );
    }
    lineItems.push({ name: product.name, unitAmount: Math.round(product.price * 100), qty: line.qty });
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems.map((item) => ({
        quantity: item.qty,
        price_data: {
          currency: "usd",
          unit_amount: item.unitAmount,
          product_data: { name: item.name },
        },
      })),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      metadata: {
        fulfillment,
        phone: body.phone?.trim() || "",
        // Kept minimal (id + qty only) to stay well under Stripe's 500-char
        // metadata value limit — the webhook re-looks-up name/price from
        // the product list at fulfillment time rather than trusting this.
        cart: JSON.stringify(requestedLines.map((l) => ({ id: l.id, qty: l.qty }))),
      },
    });

    if (!session.url) {
      console.error("[stripe] session created with no url", { sessionId: session.id });
      return NextResponse.json({ error: "Couldn't start checkout — try again." }, { status: 502 });
    }
    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe] session create failed", err);
    return NextResponse.json({ error: "Couldn't start checkout — try again." }, { status: 502 });
  }
}

// Polled once by the success page after Stripe redirects back, to confirm
// payment actually went through before showing "Order placed" — Stripe
// documents this as the right way to close the loop on a redirect-based
// Checkout integration, since a customer can land on the success URL
// without having actually completed payment (e.g. the back button).
export async function GET(request: Request) {
  if (!isStripeConfigured() || !stripe) {
    return NextResponse.json({ error: "not-configured" }, { status: 501 });
  }

  const sessionId = new URL(request.url).searchParams.get("session_id");
  if (!sessionId) {
    return NextResponse.json({ error: "missing-session" }, { status: 400 });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return NextResponse.json({
      status: session.payment_status,
      fulfillment: session.metadata?.fulfillment === "delivery" ? "delivery" : "pickup",
    });
  } catch (err) {
    console.error("[stripe] session retrieve failed", err);
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }
}
