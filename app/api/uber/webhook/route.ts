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

  return NextResponse.json({ received: true });
}
