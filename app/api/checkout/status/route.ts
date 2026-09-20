// Lets the (client-side) checkout page know whether real Stripe payments
// are wired up yet, without exposing anything sensitive — mirrors
// /api/clover/status's role for the Clover panel.
import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe";

export async function GET() {
  return NextResponse.json({ stripeConfigured: isStripeConfigured() });
}
