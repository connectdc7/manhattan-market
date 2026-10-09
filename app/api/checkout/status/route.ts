import { NextResponse } from "next/server";
import { isStripeConfigured } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    stripeConfigured: isStripeConfigured(),
    uber: {
      UBER_CUSTOMER_ID: Boolean(process.env.UBER_CUSTOMER_ID?.trim()),
      UBER_CLIENT_ID: Boolean(process.env.UBER_CLIENT_ID?.trim()),
      UBER_CLIENT_SECRET: Boolean(process.env.UBER_CLIENT_SECRET?.trim()),
      UBER_WEBHOOK_SIGNING_KEY: Boolean(process.env.UBER_WEBHOOK_SIGNING_KEY?.trim()),
      UBER_ROBO_COURIER: process.env.UBER_ROBO_COURIER === "true",
    },
  });
}
