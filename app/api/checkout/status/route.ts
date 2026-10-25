// Lets the (client-side) checkout page know whether real Stripe payments
// are wired up yet, without exposing anything sensitive — mirrors
// /api/clover/status's role for the Clover panel. Also reports which Uber
// settings the live site can see (true/false only — never the values), to
// make setup problems easy to spot by visiting this URL in a browser.
import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe";
import { isCloverCheckoutConfigured } from "@/lib/clover-checkout";
import { activePaymentProvider } from "@/lib/payments";

export const dynamic = "force-dynamic";

export async function GET() {
  const provider = await activePaymentProvider();
  return NextResponse.json({
    // true whenever real card payments are on (Stripe or Clover).
    stripeConfigured: provider !== "none",
    provider,
    stripeReady: isStripeConfigured(),
    cloverCheckoutReady: isCloverCheckoutConfigured(),
    uber: {
      UBER_CUSTOMER_ID: Boolean(process.env.UBER_CUSTOMER_ID?.trim()),
      UBER_CLIENT_ID: Boolean(process.env.UBER_CLIENT_ID?.trim()),
      UBER_CLIENT_SECRET: Boolean(process.env.UBER_CLIENT_SECRET?.trim()),
      UBER_WEBHOOK_SIGNING_KEY: Boolean(process.env.UBER_WEBHOOK_SIGNING_KEY?.trim()),
      UBER_ROBO_COURIER: process.env.UBER_ROBO_COURIER === "true",
    },
  });
}
