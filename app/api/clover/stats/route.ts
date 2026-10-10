// Dashboard sales stats from Clover (lib/clover-stats.ts) — the store's
// real register sales plus website orders sent to Clover. Staff only.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { isCloverConfigured } from "@/lib/clover";
import { getCloverStats } from "@/lib/clover-stats";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;
  if (!isCloverConfigured()) return NextResponse.json({ configured: false });
  try {
    return NextResponse.json({ configured: true, stats: await getCloverStats() });
  } catch (err) {
    return NextResponse.json(
      { configured: true, error: err instanceof Error ? err.message : "Couldn't load Clover stats." },
      { status: 502 }
    );
  }
}
