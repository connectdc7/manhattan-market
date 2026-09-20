// Shared Stripe helper, used only from server-side route handlers
// (app/api/checkout/**, app/api/stripe/**). Nothing here should ever be
// imported from a "use client" file — STRIPE_SECRET_KEY must stay on the
// server, same rule as CLOVER_APP_SECRET in lib/clover.ts.
//
// Inert until STRIPE_SECRET_KEY is set as an environment variable — until
// then `stripe` is null and isStripeConfigured() is false, and checkout
// falls back to the old mocked instant-order flow (see app/checkout/page.tsx).
import Stripe from "stripe";

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;
