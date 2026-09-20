// Where Clover sends inventory change notifications, once this URL is
// registered in the Clover app's Developer Dashboard settings.
//
// Two kinds of request land here:
// 1. A one-time verification POST ({"verificationCode": "..."}) sent the
//    moment the webhook URL is entered in Clover's dashboard — we save the
//    code so the dashboard's Clover panel can display it for staff to
//    paste back into Clover's "Verify" step.
// 2. Ongoing item-change events ({merchants: {merchantId: [{objectId,
//    type, ts}]}}) — for each changed item, re-fetch it from Clover's API
//    and upsert it into products (or delete it, for type "DELETE").
//
// Always responds 200 — Clover retries on anything else, and there's
// nothing a shopper-facing error page would add here.
import { NextResponse } from "next/server";
import {
  deleteProductByCloverItemId,
  fetchCloverItem,
  getFreshCloverConnection,
  recordWebhookEvent,
  recordWebhookVerification,
  upsertProductFromCloverItem,
} from "@/lib/clover";

type CloverWebhookEvent = { objectId?: string; type?: "CREATE" | "UPDATE" | "DELETE"; ts?: number };
type CloverWebhookBody = {
  verificationCode?: string;
  merchants?: Record<string, CloverWebhookEvent[]>;
};

export async function POST(request: Request) {
  // Optional defense-in-depth: once CLOVER_WEBHOOK_AUTH_CODE is set (the
  // "Clover Auth Code" shown in the app's webhook settings after the
  // first verification), reject anything that doesn't carry it. Left
  // unenforced until then, since the very first verification request
  // arrives before that code exists to check against.
  const expectedAuth = process.env.CLOVER_WEBHOOK_AUTH_CODE;
  if (expectedAuth && request.headers.get("x-clover-auth") !== expectedAuth) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CloverWebhookBody | null;
  if (!body) return NextResponse.json({ ok: true });

  if (typeof body.verificationCode === "string") {
    await recordWebhookVerification(body.verificationCode);
    return NextResponse.json({ ok: true });
  }

  const connection = await getFreshCloverConnection();
  if (connection && body.merchants) {
    const events = body.merchants[connection.merchant_id] ?? [];
    // TEMP DEBUG: print the raw event list Clover actually sent — safe to
    // remove once we've confirmed objectId's real shape (the "I:" prefix
    // filter below is an assumption from Clover's docs; if the live
    // payload doesn't match it, every event gets silently skipped and
    // this line is how we'd catch that).
    console.log("[clover webhook] events for merchant", connection.merchant_id, JSON.stringify(events));

    for (const event of events) {
      if (!event.objectId?.startsWith("I:")) {
        console.log("[clover webhook] skipping non-inventory objectId", event.objectId);
        continue;
      }
      const itemId = event.objectId.slice(2);

      if (event.type === "DELETE") {
        await deleteProductByCloverItemId(itemId);
        continue;
      }

      const item = await fetchCloverItem(connection.merchant_id, connection.access_token, itemId);
      if (item) {
        const saved = await upsertProductFromCloverItem(item);
        console.log("[clover webhook] upserted item", itemId, "saved:", saved);
      } else {
        console.log("[clover webhook] fetchCloverItem returned null for", itemId);
      }
    }
    await recordWebhookEvent();
  }

  return NextResponse.json({ ok: true });
}
