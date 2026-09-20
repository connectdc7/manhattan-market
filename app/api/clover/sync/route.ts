// Manual "Sync Now" pull — fetches the merchant's whole Clover catalog and
// upserts it into the products table. This is what does the initial bulk
// import; the webhook (see /api/clover/webhook) is what keeps things
// current after that without staff needing to click Sync again.
import { NextResponse } from "next/server";
import { fetchAllCloverItems, getFreshCloverConnection, isCloverConfigured, upsertProductFromCloverItem } from "@/lib/clover";

export async function POST() {
  if (!isCloverConfigured()) {
    return NextResponse.json({ error: "Clover isn't configured yet." }, { status: 501 });
  }

  const connection = await getFreshCloverConnection();
  if (!connection) {
    return NextResponse.json({ error: "Not connected to Clover yet." }, { status: 409 });
  }

  const items = await fetchAllCloverItems(connection.merchant_id, connection.access_token);
  // TEMP DEBUG: print exactly what Clover's item list returned — safe to
  // remove once Clover sync is confirmed working end to end.
  console.log("[clover sync] fetched items", JSON.stringify(items.map((i) => ({ id: i.id, name: i.name }))));

  let succeeded = 0;
  let failed = 0;
  for (const item of items) {
    const ok = await upsertProductFromCloverItem(item);
    if (ok) succeeded++;
    else failed++;
  }

  return NextResponse.json({ total: items.length, succeeded, failed });
}
