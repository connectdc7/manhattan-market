// Manual "Sync Now" pull — fetches the merchant's whole Clover catalog and
// upserts it into the products table. This is what does the initial bulk
// import; the webhook (see /api/clover/webhook) is what keeps things
// current after that without staff needing to click Sync again.
import { NextResponse } from "next/server";
import {
  fetchAllCloverItems,
  getFreshCloverConnection,
  isCloverConfigured,
  upsertProductFromCloverItem,
} from "@/lib/clover";
import { generatePhotosForItems, isImageGenConfigured } from "@/lib/image-gen";

// Pinned explicitly rather than left to Vercel's default: a catalog with
// several items still missing a photo can spend real time in
// generatePhotosForItems below (several seconds per image, even batched
// a few at a time), and this is the number that budget is measured
// against. 300s is the ceiling on Vercel's Hobby plan and the default on
// Pro — see README's "AI-generated product photos" section.
export const maxDuration = 300;

export async function POST() {
  if (!isCloverConfigured()) {
    return NextResponse.json({ error: "Clover isn't configured yet." }, { status: 501 });
  }

  const connection = await getFreshCloverConnection();
  if (!connection) {
    return NextResponse.json({ error: "Not connected to Clover yet." }, { status: 409 });
  }

  const items = await fetchAllCloverItems(connection.merchant_id, connection.access_token);

  let succeeded = 0;
  let failed = 0;
  // Collected as items are upserted, then generated afterward as its own
  // pass (a few at a time — see generatePhotosForItems) rather than one at
  // a time inside this loop. Doing it inline here was the original
  // approach, and it's why a sync with many missing photos would only get
  // through the first handful before running long: this keeps the fast
  // data sync and the slow photo generation from being tangled together.
  const needsPhoto: { id: string; name: string; category: string }[] = [];

  for (const item of items) {
    const result = await upsertProductFromCloverItem(item);
    if (result.ok) succeeded++;
    else failed++;
    if (result.ok && result.needsPhoto && result.id) {
      needsPhoto.push({ id: result.id, name: result.name, category: result.category });
    }
  }

  const photos = isImageGenConfigured()
    ? await generatePhotosForItems(needsPhoto)
    : { generated: 0, failed: 0, skipped: needsPhoto.length };

  return NextResponse.json({ total: items.length, succeeded, failed, photos });
}
