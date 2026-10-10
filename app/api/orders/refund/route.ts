// Dashboard "Refund" button — owner only. See lib/order-refund.ts for what
// a refund does (Stripe, Clover, stock, Uber).
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { refundOrder } from "@/lib/order-refund";

export const maxDuration = 60;

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request, { owner: true });
  if (!staffCheck.ok) return staffCheck.response;

  let body: { orderId?: string; items?: { id: string; qty: number }[]; includeFees?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Bad request." }, { status: 400 });
  }
  if (!body.orderId) return NextResponse.json({ ok: false, error: "Missing order." }, { status: 400 });

  const result = await refundOrder({
    orderId: body.orderId,
    items: Array.isArray(body.items) ? body.items.filter((i) => i && typeof i.id === "string" && Number(i.qty) > 0) : undefined,
    includeFees: Boolean(body.includeFees),
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
