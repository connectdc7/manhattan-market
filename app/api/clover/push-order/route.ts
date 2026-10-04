// Dashboard "Send to Clover" button on an order — for retrying a failed
// send, or sending an order placed before Clover was connected. Staff-only.
// Paid online orders are normally sent automatically by the Stripe webhook.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { pushOrderToClover } from "@/lib/clover-orders";

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

  const result = await pushOrderToClover(body.orderId);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
