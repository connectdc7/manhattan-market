// Dashboard: cancel the Uber courier for an order (e.g. customer called to
// cancel, or the order was booked by mistake). Uber only allows this before
// the courier has picked up. Staff-only.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { cancelUberDelivery, isUberConfigured } from "@/lib/uber";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;
  if (!isUberConfigured() || !supabaseAdmin) {
    return NextResponse.json({ error: "Uber delivery isn't set up." }, { status: 501 });
  }

  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("uber_delivery_id")
    .eq("id", body.orderId ?? "")
    .maybeSingle();
  if (!order?.uber_delivery_id) return NextResponse.json({ error: "No courier booked for this order." }, { status: 404 });

  const result = await cancelUberDelivery(order.uber_delivery_id);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 502 });

  await supabaseAdmin.from("orders").update({ uber_status: "canceled" }).eq("id", body.orderId);
  return NextResponse.json({ ok: true });
}
