import { NextResponse } from "next/server";
import { isTwilioConfigured, sendSms } from "@/lib/twilio";

// Called from the dashboard the moment staff mark an order Ready (see
// lib/orders.ts's notifyOrderReady). Best-effort: an order still moves to
// Ready in the UI even if this fails or Twilio isn't configured yet.
export async function POST(request: Request) {
  if (!isTwilioConfigured()) {
    return NextResponse.json({ sent: false, reason: "not-configured" }, { status: 200 });
  }

  let body: { orderId?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ sent: false, reason: "bad-request" }, { status: 400 });
  }

  if (!body.phone) {
    return NextResponse.json({ sent: false, reason: "missing-phone" }, { status: 400 });
  }

  const result = await sendSms(
    body.phone,
    "Manhattan Market: your order's ready! Come on by to pick it up."
  );

  return NextResponse.json({ sent: result.ok, reason: result.error }, { status: 200 });
}
