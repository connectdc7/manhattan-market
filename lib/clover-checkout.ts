// Online card payments through Clover Hosted Checkout — the alternative to
// Stripe. Server-only.
//
// How it works: the checkout API (app/api/checkout/session) creates a
// Clover checkout session and sends the customer to Clover's secure payment
// page. When they pay, Clover calls app/api/clover/checkout-webhook, which
// creates the order — same as the Stripe webhook does today. The money goes
// straight into the store's Clover account.
//
// Needs, in Vercel (the owner creates these in their Clover web dashboard):
//   CLOVER_ECOMM_PRIVATE_KEY    Settings → Ecommerce → API Tokens → create a
//                               "Hosted Checkout" token → the PRIVATE key (Sensitive)
//   CLOVER_HCO_WEBHOOK_SECRET   Settings → Ecommerce → Hosted Checkout →
//                               Webhook → Generate (Sensitive)
// plus the CLOVER_MERCHANT_ID and CLOVER_ENV already set for the Clover sync.
// Then the owner picks "Clover" in Dashboard → Settings → Online payments.
import { createHmac, timingSafeEqual } from "crypto";
import { cloverUrls } from "./clover";

const PRIVATE_KEY = () => process.env.CLOVER_ECOMM_PRIVATE_KEY?.trim() ?? "";
const WEBHOOK_SECRET = () => process.env.CLOVER_HCO_WEBHOOK_SECRET?.trim() ?? "";
const MERCHANT_ID = () => process.env.CLOVER_MERCHANT_ID?.trim() ?? "";

export function isCloverCheckoutConfigured(): boolean {
  return Boolean(PRIVATE_KEY() && WEBHOOK_SECRET() && MERCHANT_ID());
}

// Clover's card-payment ("ecommerce") API lives on its own host.
function ecommHost() {
  return process.env.CLOVER_ENV === "production" ? "https://scl.clover.com" : "https://scl-sandbox.dev.clover.com";
}

export type HostedCheckoutLine = { name: string; priceCents: number; qty: number; note?: string };

export type HostedCheckoutResult =
  | { ok: true; href: string; checkoutSessionId: string }
  | { ok: false; error: string };

export async function createHostedCheckout(input: {
  lines: HostedCheckoutLine[];
  successUrl: string;
  failureUrl: string;
  firstName?: string;
}): Promise<HostedCheckoutResult> {
  if (!isCloverCheckoutConfigured()) return { ok: false, error: "Clover payments aren't set up." };
  try {
    const res = await fetch(`${cloverUrls().api}/invoicingcheckoutservice/v1/checkouts`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${PRIVATE_KEY()}`,
        "X-Clover-Merchant-Id": MERCHANT_ID(),
      },
      body: JSON.stringify({
        // Clover wants a customer object; without its "customer info" option
        // turned on it accepts at most one name/email field.
        customer: input.firstName ? { firstName: input.firstName.slice(0, 40) } : {},
        shoppingCart: {
          lineItems: input.lines.map((l) => ({
            name: l.name.slice(0, 127),
            price: l.priceCents,
            unitQty: l.qty,
            note: l.note ?? "",
          })),
        },
        redirectUrls: { success: input.successUrl, failure: input.failureUrl },
      }),
    });
    const body = (await res.json().catch(() => null)) as { href?: string; checkoutSessionId?: string; message?: string } | null;
    if (!res.ok || !body?.href || !body.checkoutSessionId) {
      console.error("[clover checkout] create failed", { status: res.status, body });
      return { ok: false, error: `Clover didn't start the checkout (HTTP ${res.status}).` };
    }
    return { ok: true, href: body.href, checkoutSessionId: body.checkoutSessionId };
  } catch (err) {
    console.error("[clover checkout] create threw", err);
    return { ok: false, error: "Couldn't reach Clover." };
  }
}

// Clover-Signature: t=<timestamp>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
export function verifyHostedCheckoutSignature(rawBody: string, header: string | null): boolean {
  const secret = WEBHOOK_SECRET();
  if (!secret || !header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const i = p.indexOf("=");
      return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
    })
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) return false;
  const expected = createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(v1, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

// Refund a Hosted Checkout payment (whole thing, or `amountCents` of it).
export async function refundCloverPayment(
  paymentId: string,
  amountCents: number | undefined,
  idempotencyKey: string
): Promise<{ ok: true; amountCents: number } | { ok: false; error: string }> {
  if (!PRIVATE_KEY()) return { ok: false, error: "Clover payments aren't set up." };
  try {
    const res = await fetch(`${ecommHost()}/v1/refunds`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${PRIVATE_KEY()}`,
        "idempotency-key": idempotencyKey.slice(0, 255),
      },
      body: JSON.stringify({ charge: paymentId, ...(amountCents ? { amount: amountCents } : {}) }),
    });
    const body = (await res.json().catch(() => null)) as { amount?: number; error?: { message?: string }; message?: string } | null;
    if (!res.ok) {
      console.error("[clover refund] failed", { status: res.status, body });
      const msg = body?.error?.message || body?.message || `HTTP ${res.status}`;
      return { ok: false, error: `Clover couldn't refund it: ${msg}. You can refund it on the Clover device instead.` };
    }
    return { ok: true, amountCents: typeof body?.amount === "number" ? body.amount : amountCents ?? 0 };
  } catch (err) {
    console.error("[clover refund] threw", err);
    return { ok: false, error: "Couldn't reach Clover to refund — try again, or refund on the Clover device." };
  }
}
