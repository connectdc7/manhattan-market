// Dashboard: request an Uber courier for a delivery order. Called
// automatically when staff mark a delivery order Ready, and by the
// "Request courier" button for retries. Staff-only.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { dispatchOrderToUber } from "@/lib/uber-dispatch";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  if (!body.orderId) return NextResponse.json({ error: "Missing orderId." }, { status: 400 });

  const result = await dispatchOrderToUber(body.orderId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
