// "Find product photos" on the dashboard's Inventory tab — looks up real,
// free package photos by barcode (see lib/photo-lookup.ts). Each click
// works through as many products as fit in ~4 minutes; click again to
// continue. Automatic Clover syncs also chip away at it in the background.
import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/require-staff";
import { findProductPhotos } from "@/lib/photo-lookup";

export const maxDuration = 300;

export async function POST(request: Request) {
  const staffCheck = await requireStaff(request);
  if (!staffCheck.ok) return staffCheck.response;

  const result = await findProductPhotos({ limit: 400, timeBudgetMs: 240_000 });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 });
  return NextResponse.json(result);
}
