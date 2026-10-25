// Called by the dashboard when staff mark an online order Completed — marks
// it Paid and closed on Clover too (see lib/clover-complete.ts). Staff-only.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { completeCloverOrder } from "@/lib/clover-complete";

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

  const result = await completeCloverOrder(body.orderId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
