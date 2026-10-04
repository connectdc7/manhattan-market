// Lets the dashboard show the verification code Clover's webhook setup
// sent (see app/api/clover/webhook/route.ts) so staff can copy it into
// Clover's "Verify" step, plus whether any real event has arrived since.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { getWebhookState } from "@/lib/clover";

export async function GET(request: Request) {
  // Dashboard-only: must come from a signed-in staffer (lib/require-staff.ts).
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;

  const state = await getWebhookState();
  return NextResponse.json(state ?? { lastVerificationCode: null, lastEventAt: null });
}
