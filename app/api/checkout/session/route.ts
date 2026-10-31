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
import { randomUUID } from "crypto";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { activePaymentProvider } from "@/lib/payments";
import { createHostedCheckout, HostedCheckoutLine } from "@/lib/clover-checkout";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { checkWelcomeCode } from "@/lib/welcome-offer";
import { getDefaultTaxRates, taxLines, TaxableLine } from "@/lib/tax-server";
import type { TaxRate } from "@/lib/tax";
import { getProductsByIds } from "@/lib/products";
import { getStoreSettings } from "@/lib/settings";
import { getCategories } from "@/lib/categories";
import { getDeliveryQuote, isUberConfigured, toE164, validateDeliveryAddress, DeliveryAddress } from "@/lib/uber";

type RequestLine = { id: string; qty: number };

export async function POST(request: Request) {
  // Stripe or Clover (owner's choice, Dashboard → Settings → Online payments).
  const provider = await activePaymentProvider();
  if (provider === "none" || (provider === "stripe" && !stripe)) {
    return NextResponse.json({ mock: true });
  }

  let body: {
    items?: RequestLine[];
    fulfillment?: "pickup" | "delivery";
    phone?: string | null;
    delivery?: Partial<DeliveryAddress> | null;
    ageConfirmed?: boolean;
    promoCode?: string | null;
  };
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

  const products = await getProductsByIds(requestedLines.map((l) => l.id));
  const categories = await getCategories();
  // Items staff took off the website (or whose department is hidden, like
  // wine & beer for now) can't be bought online even from an old cart.
  const onSite = new Set(categories.filter((c) => c.showOnStorefront && !c.needsReview).map((c) => c.name));
  const lineItems: { name: string; unitAmount: number; qty: number; productRates: TaxRate[] | null | undefined }[] = [];

  for (const line of requestedLines) {
    const product = products.find((p) => p.id === line.id);
    if (!product || product.hide_online || !onSite.has(product.category)) {
      return NextResponse.json(
        { error: product ? `"${product.name}" isn't available online right now — remove it from your cart to continue.` : "One of the items in your cart is no longer available." },
        { status: 409 }
      );
    }
    if (line.qty > product.stock) {
      return NextResponse.json(
        { error: `Only ${product.stock} of "${product.name}" left — update your cart and try again.` },
        { status: 409 }
      );
    }
    lineItems.push({ name: product.name, unitAmount: Math.round(product.price * 100), qty: line.qty, productRates: product.tax_rates });
  }

  // First-order welcome code (lib/welcome-offer.ts) — checked again here.
  let promo: { code: string; discountCents: number } | null = null;
  if (body.promoCode?.trim()) {
    const itemsSubtotalCents = lineItems.reduce((sum, i) => sum + i.unitAmount * i.qty, 0);
    const check = await checkWelcomeCode({ code: body.promoCode, phone: body.phone, itemsSubtotalCents });
    if (!check.ok) return NextResponse.json({ error: check.error, promoInvalid: true }, { status: 400 });
    promo = { code: check.code, discountCents: check.discountCents };
  }

  // Wine/beer (21+ categories): customer must confirm age, and delivery is
  // only allowed once the owner switches it on (dashboard → Settings).
  const restricted = new Set(categories.filter((c) => c.ageRestricted).map((c) => c.name));
  const containsAlcohol = requestedLines.some((l) => {
    const p = products.find((x) => x.id === l.id);
    return p ? restricted.has(p.category) : false;
  });
  if (containsAlcohol) {
    if (!body.ageConfirmed) {
      return NextResponse.json({ error: "Please confirm you're 21 or older to buy wine or beer." }, { status: 400 });
    }
    if (fulfillment === "delivery" && !(await getStoreSettings()).alcoholDelivery) {
      return NextResponse.json(
        { error: "Orders with wine or beer are pickup only for now — switch to pickup to continue." },
        { status: 400 }
      );
    }
  }

  // Delivery: check the address and take Uber's fee from Uber directly
  // (never from the browser). Without Uber set up, delivery still works
  // with no fee and staff arrange it themselves.
  let deliveryFee = 0;
  let serviceFee = 0;
  let deliveryMeta = "";
  let deliveryInfo: Record<string, string | number> | null = null;
  if (fulfillment === "delivery") {
    const invalid = validateDeliveryAddress(body.delivery);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });
    const address = body.delivery as DeliveryAddress;
    if (isUberConfigured()) {
      if (!toE164(body.phone)) {
        return NextResponse.json({ error: "Enter a phone number so the courier can reach you." }, { status: 400 });
      }
      const quote = await getDeliveryQuote(address, body.phone ?? null);
      if (!quote.ok) {
        return NextResponse.json({ error: quote.message, undeliverable: quote.undeliverable }, { status: 409 });
      }
      deliveryFee = quote.quote.fee;
    }
    // Owner-set flat service fee (dashboard → Settings), read from the
    // database here — never from the browser.
    serviceFee = (await getStoreSettings()).deliveryServiceFee;
    deliveryInfo = {
      name: address.name.trim().slice(0, 60),
      street: address.street.trim().slice(0, 100),
      apt: (address.apt ?? "").trim().slice(0, 30),
      city: address.city.trim().slice(0, 40),
      state: address.state.trim().slice(0, 20),
      zip: address.zip.trim().slice(0, 10),
      notes: (address.notes ?? "").trim().slice(0, 150),
      fee: deliveryFee,
      service: serviceFee,
    };
    deliveryMeta = JSON.stringify(deliveryInfo);
  }

  const origin = request.headers.get("origin") ?? new URL(request.url).origin;

  // DC sales tax — each item taxed at the rates it has in Clover (lib/tax.ts),
  // after the welcome discount, exactly like the register would.
  const tax = taxLines(
    lineItems.map((i) => ({ name: i.name, priceCents: i.unitAmount, qty: i.qty, productRates: i.productRates })),
    await getDefaultTaxRates(),
    promo?.discountCents ?? 0
  );

  if (provider === "clover") {
    return startCloverCheckout({
      origin,
      taxedLines: tax.lines,
      taxCents: tax.taxCents,
      deliveryFee,
      serviceFee,
      cart: requestedLines.map((l) => ({ id: l.id, qty: l.qty })),
      fulfillment,
      phone: body.phone?.trim() || "",
      delivery: deliveryInfo,
      alcohol: containsAlcohol,
      promo,
    });
  }
  if (!stripe) return NextResponse.json({ mock: true });

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        ...lineItems.map((item) => ({
          quantity: item.qty,
          price_data: {
            currency: "usd",
            unit_amount: item.unitAmount,
            product_data: { name: item.name },
          },
        })),
        ...(deliveryFee > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: Math.round(deliveryFee * 100),
                  product_data: { name: "Delivery (Uber)" },
                },
              },
            ]
          : []),
        ...(serviceFee > 0
          ? [
              {
                quantity: 1,
                price_data: {
                  currency: "usd",
                  unit_amount: Math.round(serviceFee * 100),
                  product_data: { name: "Service fee" },
                },
              },
            ]
          : []),
        ...(tax.taxCents > 0
          ? [{ quantity: 1, price_data: { currency: "usd", unit_amount: tax.taxCents, product_data: { name: "DC sales tax" } } }]
          : []),
      ],
      ...(promo ? { discounts: [{ coupon: await welcomeCoupon(promo.discountCents) }] } : {}),
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/checkout`,
      metadata: {
        fulfillment,
        phone: body.phone?.trim() || "",
        // Kept minimal (id + qty only) to stay well under Stripe's 500-char
        // metadata value limit — the webhook re-looks-up name/price from
        // the product list at fulfillment time rather than trusting this.
        cart: JSON.stringify(requestedLines.map((l) => ({ id: l.id, qty: l.qty }))),
        ...(containsAlcohol ? { alcohol: "1" } : {}),
        ...(promo ? { promo: promo.code, discount: String(promo.discountCents) } : {}),
        ...(tax.taxCents > 0 ? { tax: String(tax.taxCents) } : {}),
        ...(deliveryMeta ? { delivery: deliveryMeta } : {}),
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

// One reusable Stripe coupon per discount amount ("$5 off, once").
async function welcomeCoupon(discountCents: number): Promise<string> {
  const id = `mm-welcome-${discountCents}`;
  try {
    await stripe!.coupons.retrieve(id);
  } catch {
    await stripe!.coupons.create({ id, amount_off: discountCents, currency: "usd", duration: "once", name: "Welcome offer" });
  }
  return id;
}

// Clover Hosted Checkout: remember the cart (the webhook only tells us the
// checkout id), then send the customer to Clover's payment page.
async function startCloverCheckout(c: {
  origin: string;
  taxedLines: TaxableLine[];
  taxCents: number;
  deliveryFee: number;
  serviceFee: number;
  cart: { id: string; qty: number }[];
  fulfillment: "pickup" | "delivery";
  phone: string;
  delivery: Record<string, string | number> | null;
  alcohol: boolean;
  promo: { code: string; discountCents: number } | null;
}) {
  if (!supabaseAdmin) return NextResponse.json({ error: "Checkout isn't available right now." }, { status: 503 });
  // Clover's checkout has no coupons — the welcome discount is already taken
  // off item prices (lib/tax-server.ts). Each item carries its tax rates and
  // Clover adds the tax on its payment page.
  const lines: HostedCheckoutLine[] = [
    ...c.taxedLines,
    ...(c.deliveryFee > 0 ? [{ name: "Delivery (Uber)", priceCents: Math.round(c.deliveryFee * 100), qty: 1 }] : []),
    ...(c.serviceFee > 0 ? [{ name: "Service fee", priceCents: Math.round(c.serviceFee * 100), qty: 1 }] : []),
  ];
  const totalCents = lines.reduce((sum, l) => sum + l.priceCents * l.qty, 0) + c.taxCents;
  const ref = randomUUID();

  const created = await createHostedCheckout({
    lines,
    successUrl: `${c.origin}/checkout/success?ref=${ref}`,
    failureUrl: `${c.origin}/checkout?payment=failed`,
    firstName: typeof c.delivery?.name === "string" ? c.delivery.name : undefined,
  });
  if (!created.ok) return NextResponse.json({ error: "Couldn't start checkout — try again." }, { status: 502 });

  const { error } = await supabaseAdmin.from("pending_checkouts").insert({
    id: created.checkoutSessionId,
    ref,
    payload: {
      cart: c.cart,
      fulfillment: c.fulfillment,
      phone: c.phone,
      delivery: c.delivery,
      alcohol: c.alcohol,
      totalCents,
      taxCents: c.taxCents,
      ...(c.promo ? { promo: c.promo.code, discountCents: c.promo.discountCents } : {}),
    },
  });
  if (error) {
    console.error("[clover checkout] couldn't save pending checkout", error.message);
    return NextResponse.json({ error: "Couldn't start checkout — try again." }, { status: 502 });
  }
  return NextResponse.json({ url: created.href });
}

// Polled once by the success page after Stripe redirects back, to confirm
// payment actually went through before showing "Order placed" — Stripe
// documents this as the right way to close the loop on a redirect-based
// Checkout integration, since a customer can land on the success URL
// without having actually completed payment (e.g. the back button).
export async function GET(request: Request) {
  // Clover: the webhook marks the pending checkout paid (it can land a few
  // seconds after the customer is sent back — the success page re-checks).
  const ref = new URL(request.url).searchParams.get("ref");
  if (ref) {
    if (!supabaseAdmin || !/^[0-9a-f-]{36}$/i.test(ref)) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const { data } = await supabaseAdmin.from("pending_checkouts").select("status, payload").eq("ref", ref).maybeSingle();
    if (!data) return NextResponse.json({ error: "not-found" }, { status: 404 });
    const payload = data.payload as { fulfillment?: string } | null;
    return NextResponse.json({
      status: data.status === "paid" ? "paid" : data.status === "declined" ? "unpaid" : "pending",
      fulfillment: payload?.fulfillment === "delivery" ? "delivery" : "pickup",
    });
  }

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
