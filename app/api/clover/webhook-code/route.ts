// Lets the dashboard show the verification code Clover's webhook setup
// sent (see app/api/clover/webhook/route.ts) so staff can copy it into
// Clover's "Verify" step, plus whether any real event has arrived since.
import { NextResponse } from "next/server";
import { getWebhookState } from "@/lib/clover";

export async function GET() {
  const state = await getWebhookState();
  return NextResponse.json(state ?? { lastVerificationCode: null, lastEventAt: null });
}
