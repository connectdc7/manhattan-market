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
  loadCloverCategoryContext,
  recordWebhookEvent,
  recordWebhookVerification,
  upsertProductFromCloverItem,
} from "@/lib/clover";
import { generateAndSavePhoto, isImageGenConfigured } from "@/lib/image-gen";

type CloverWebhookEvent = { objectId?: string; type?: "CREATE" | "UPDATE" | "DELETE"; ts?: number };
type CloverWebhookBody = {
  verificationCode?: string;
  merchants?: Record<string, CloverWebhookEvent[]>;
};

// A single webhook delivery can carry several item events at once, each
// possibly needing its own generated photo — pinned for the same reason
// as /api/clover/sync (see there for the full explanation).
export const maxDuration = 300;

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
    // Loaded once per delivery, same reasoning as /api/clover/sync — see
    // loadCloverCategoryContext's comment in lib/clover.ts.
    const categoryContext = await loadCloverCategoryContext();

    for (const event of events) {
      if (!event.objectId?.startsWith("I:")) continue;
      const itemId = event.objectId.slice(2);

      if (event.type === "DELETE") {
        await deleteProductByCloverItemId(itemId);
        continue;
      }

      const item = await fetchCloverItem(connection.merchant_id, connection.access_token, itemId);
      if (!item) continue;

      const result = await upsertProductFromCloverItem(item, categoryContext);
      if (result.ok && result.needsPhoto && result.id && isImageGenConfigured()) {
        await generateAndSavePhoto(result.id, result.name, result.category);
      }
    }
    await recordWebhookEvent();
  }

  return NextResponse.json({ ok: true });
}
