// "Send a test alert" — pushes a sample notification to the signed-in
// staff member's own phones, to check alerts work. Staff-only.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { isPushConfigured, notifyStaffMember } from "@/lib/push";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;
  if (!isPushConfigured()) {
    return NextResponse.json({ error: "Alerts aren't set up yet — add the VAPID keys in Vercel." }, { status: 503 });
  }
  const result = await notifyStaffMember(staffCheck.userId, {
    title: "Test alert · Manhattan Market",
    body: "Order alerts are working on this phone. New online orders will show up like this.",
    tag: "mm-test",
  });
  return NextResponse.json({ ok: true, ...result });
}
