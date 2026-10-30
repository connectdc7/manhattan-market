// Uber calls this every time a delivery's status changes (courier
// assigned, picked up, delivered, canceled…). Register it in the Uber
// Direct dashboard → Developer → Webhooks → Create Webhook, with
// "Delivery Status" selected, then copy that webhook's signing key into
// Vercel as UBER_WEBHOOK_SIGNING_KEY.
//
// Updates the matching order so the dashboard (which listens for order
// changes live) shows where the courier is. A "delivered" status also
// moves the order to Completed automatically.
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { verifyUberSignature } from "@/lib/uber";
import { completeCloverOrder } from "@/lib/clover-complete";

export const runtime = "nodejs";

type UberEvent = {
  kind?: string;
  status?: string;
  delivery_id?: string;
  data?: {
    id?: string;
    status?: string;
    external_id?: string;
    tracking_url?: string;
    courier?: { name?: string; vehicle_type?: string; phone_number?: string } | null;
    pickup_eta?: string;
    dropoff_eta?: string;
  };
};

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-uber-signature") ?? request.headers.get("x-postmates-signature");
  if (!verifyUberSignature(raw, signature)) {
    console.error("[uber webhook] signature check failed — is UBER_WEBHOOK_SIGNING_KEY set to this webhook's key?");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let event: UberEvent;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }

  // Only delivery status changes matter here; acknowledge everything else.
  if (event.kind !== "event.delivery_status" || !supabaseAdmin) {
    return NextResponse.json({ received: true });
  }

  const deliveryId = event.delivery_id ?? event.data?.id;
  const status = event.status ?? event.data?.status;
  if (!deliveryId || !status) return NextResponse.json({ received: true });

  const update: Record<string, unknown> = { uber_status: status };
  if (event.data?.tracking_url) update.uber_tracking_url = event.data.tracking_url;
  if (event.data?.courier) update.uber_courier = event.data.courier;
  if (status === "delivered") update.status = "completed";

  let { data } = await supabaseAdmin.from("orders").update(update).eq("uber_delivery_id", deliveryId).select("id");
  // Fall back to our own order id (sent to Uber as external_id).
  if ((!data || data.length === 0) && event.data?.external_id) {
    ({ data } = await supabaseAdmin.from("orders").update(update).eq("id", event.data.external_id).select("id"));
  }
  if (!data || data.length === 0) console.warn("[uber webhook] no order matched", { deliveryId, status });

  // Latest time estimates for the dashboard (separate, so an older database
  // without these columns doesn't break the status update above).
  const etas: Record<string, string> = {};
  if (event.data?.pickup_eta) etas.uber_pickup_eta = event.data.pickup_eta;
  if (event.data?.dropoff_eta) etas.uber_dropoff_eta = event.data.dropoff_eta;
  if (Object.keys(etas).length && data?.length) {
    const { error: etaError } = await supabaseAdmin.from("orders").update(etas).in("id", data.map((r) => r.id as string));
    if (etaError) console.warn("[uber webhook] couldn't save ETAs —", etaError.message);
  }

  // Delivered = completed → mark it Paid and closed on Clover too.
  if (status === "delivered") {
    for (const row of data ?? []) {
      const r = await completeCloverOrder(row.id as string);
      if (!r.ok) console.error("[uber webhook] clover complete failed", { orderId: row.id, error: r.error });
    }
  }

  return NextResponse.json({ received: true });
}
