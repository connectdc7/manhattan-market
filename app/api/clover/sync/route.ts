// Manual "Sync Now" pull — fetches the merchant's whole Clover catalog and
// upserts it into the products table. This is what does the initial bulk
// import; the webhook (see /api/clover/webhook) is what keeps things
// current after that without staff needing to click Sync again.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { getFreshCloverConnection, isCloverConfigured } from "@/lib/clover";
import { syncAllCloverItems } from "@/lib/clover-sync";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { generatePhotosForItems, isImageGenConfigured } from "@/lib/image-gen";

// 300s is the ceiling on Vercel's Hobby plan. The bulk sync itself takes
// seconds; the time budget is for AI photos (when OPENAI_API_KEY is set).
export const maxDuration = 300;

// AI photos are slow (several seconds each), so each sync only does this
// many — clicking Sync Now again carries on with the next batch.
const PHOTOS_PER_SYNC = 20;

export async function POST(request: Request) {
  // Dashboard-only: must come from a signed-in staffer (lib/require-staff.ts).
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;

  if (!isCloverConfigured()) {
    return NextResponse.json({ error: "Clover isn't configured yet." }, { status: 501 });
  }
  if (!(await getFreshCloverConnection())) {
    return NextResponse.json({ error: "Not connected to Clover yet." }, { status: 409 });
  }

  // Push back the next background auto-sync so it doesn't run alongside
  // this one and trip Clover's rate limit.
  await supabaseAdmin
    ?.from("clover_webhook_state")
    .upsert({ id: "singleton", last_auto_sync_at: new Date().toISOString() });

  const result = await syncAllCloverItems();
  if (!result.ok && result.succeeded === 0) {
    return NextResponse.json({ error: result.error || "Sync failed." }, { status: 502 });
  }

  const photos = isImageGenConfigured()
    ? await generatePhotosForItems(result.needsPhoto.slice(0, PHOTOS_PER_SYNC))
    : { generated: 0, failed: 0, skipped: result.needsPhoto.length };

  return NextResponse.json({ total: result.total, succeeded: result.succeeded, failed: result.failed, photos });
}
