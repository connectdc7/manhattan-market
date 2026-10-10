// Full Clover catalog → products table, in bulk. Used by the dashboard's
// "Sync Now" (app/api/clover/sync) and the API-token auto-sync
// (lib/clover-autosync.ts).
//
// The original sync saved one item at a time (two database round trips per
// item), which is fine for a handful of sandbox items but runs past
// Vercel's time limit on a real store's catalog of thousands. This version
// reads every linked product once, then writes in batches of 500 — a full
// store syncs in seconds.
//
// New products get an id built from the name plus the Clover item id, so
// two syncs running at the same moment (a page-visit auto-sync and a Sync
// Now click) write the same row instead of creating duplicates.
import { supabaseAdmin } from "./supabase-admin";
import {
  fetchAllCloverItems,
  getFreshCloverConnection,
  loadCloverCategoryContext,
  mapCloverItemToProductFields,
} from "./clover";

const BATCH = 500;

export type CloverSyncResult = {
  ok: boolean;
  error?: string;
  total: number;
  succeeded: number;
  failed: number;
  needsPhoto: { id: string; name: string; category: string }[];
};

function productIdFor(name: string, cloverItemId: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "product"}-${cloverItemId.toLowerCase().slice(-6)}`;
}

// Clover's "code" field holds whatever staff typed or scanned — keep it only
// when it looks like a real product barcode (UPC/EAN: 8–14 digits).
function cleanBarcode(code: string | undefined): string | null {
  const digits = (code ?? "").replace(/\s/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

export async function syncAllCloverItems(): Promise<CloverSyncResult> {
  const empty = { total: 0, succeeded: 0, failed: 0, needsPhoto: [] };
  const admin = supabaseAdmin;
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing.", ...empty };

  const connection = await getFreshCloverConnection();
  if (!connection) return { ok: false, error: "Not connected to Clover yet.", ...empty };

  let items;
  try {
    items = await fetchAllCloverItems(connection.merchant_id, connection.access_token);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Couldn't reach Clover.", ...empty };
  }
  if (items.length === 0) return { ok: true, ...empty };

  // Every product already linked to a Clover item (paged — Supabase returns
  // at most 1,000 rows per request).
  const existing = new Map<string, { id: string; image_url: string | null }>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("products")
      .select("id, image_url, clover_item_id")
      .not("clover_item_id", "is", null)
      .range(from, from + 999);
    if (error) return { ok: false, error: `Couldn't read products: ${error.message}`, ...empty, total: items.length };
    for (const row of data ?? []) existing.set(row.clover_item_id as string, { id: row.id, image_url: row.image_url });
    if (!data || data.length < 1000) break;
  }

  const ctx = await loadCloverCategoryContext();
  type Row = { id: string; name: string; category: string; price: number; stock: number; clover_item_id: string; barcode?: string | null };
  const rows = new Map<string, Row>();
  const needsPhoto: CloverSyncResult["needsPhoto"] = [];

  for (const item of items) {
    // Category lookups are in memory; only a brand-new department touches the database.
    const fields = await mapCloverItemToProductFields(item, ctx);
    const prior = existing.get(item.id);
    const id = prior?.id ?? productIdFor(fields.name, item.id);
    rows.set(id, { id, ...fields, clover_item_id: item.id, barcode: cleanBarcode(item.code) });
    if (!prior?.image_url) needsPhoto.push({ id, name: fields.name, category: fields.category });
  }

  // Upsert on the primary key: existing rows get name/category/price/stock
  // refreshed (blurb, photo and flags are left alone); new rows are inserted
  // with the table's defaults for everything else.
  let all: Row[] = [...rows.values()];
  let succeeded = 0;
  let failed = 0;
  for (let i = 0; i < all.length; i += BATCH) {
    const batch = all.slice(i, i + BATCH);
    let { error } = await admin.from("products").upsert(batch, { onConflict: "id" });
    if (error && /barcode/i.test(error.message)) {
      // supabase/product-photos.sql hasn't been run yet — sync without barcodes.
      console.warn("[clover sync] products.barcode missing — run supabase/product-photos.sql");
      all = all.map(({ barcode: _omit, ...rest }) => rest);
      ({ error } = await admin.from("products").upsert(all.slice(i, i + BATCH), { onConflict: "id" }));
    }
    if (error) {
      console.error("[clover sync] batch failed", { from: i, size: batch.length, error: error.message });
      failed += batch.length;
    } else {
      succeeded += batch.length;
    }
  }

  console.log(`[clover sync] ${succeeded}/${items.length} items saved, ${failed} failed`);
  return {
    ok: failed === 0,
    error: failed ? `${failed} items failed to save — see Vercel logs.` : undefined,
    total: items.length,
    succeeded,
    failed,
    needsPhoto,
  };
}
