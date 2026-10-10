// Free product photos by barcode, from the Open Food Facts family of open
// databases (openfoodfacts.org — packaged food & drinks; plus its sister
// sites for beauty/personal care and other household products). No API key
// and no cost. Their photos are licensed CC BY-SA, so the site footer
// credits "Open Food Facts contributors".
//
// Works through products that have a barcode (synced from Clover's item
// "code") but no photo yet, a batch at a time, and records when each was
// checked (products.photo_lookup_at) so misses aren't retried every run.
// Called from the dashboard's "Find product photos" button and, a small
// batch at a time, after each automatic Clover sync. Columns come from
// supabase/product-photos.sql. Server-only.
import { supabaseAdmin } from "./supabase-admin";
import { guessAisle } from "./aisles";

const USER_AGENT = "ManhattanMarket/1.0 (manhattan-market.vercel.app)";
// Open Food Facts asks for at most ~100 product lookups a minute per site.
const GAP_MS = 700;

const FOOD = "https://world.openfoodfacts.org";
const BEAUTY = "https://world.openbeautyfacts.org";
const PRODUCTS = "https://world.openproductsfacts.org";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function lookupOn(base: string, barcode: string): Promise<string | null> {
  try {
    const res = await fetch(`${base}/api/v2/product/${barcode}?fields=image_front_url,image_url`, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!res.ok) return null; // 404 = not in this database
    const body = (await res.json()) as { status?: number; product?: { image_front_url?: string; image_url?: string } };
    if (body.status !== 1) return null;
    return body.product?.image_front_url || body.product?.image_url || null;
  } catch {
    return null;
  }
}

// UPC-A barcodes (12 digits) are often stored as EAN-13 with a leading 0.
function variants(barcode: string): string[] {
  return barcode.length === 12 ? [barcode, `0${barcode}`] : [barcode];
}

async function findPhoto(barcode: string, category: string): Promise<string | null> {
  const household = guessAisle(category) === "Household & Personal Care";
  const sites = household ? [PRODUCTS, BEAUTY, FOOD] : [FOOD, PRODUCTS];
  for (const site of sites) {
    for (const code of variants(barcode)) {
      const url = await lookupOn(site, code);
      await sleep(GAP_MS);
      if (url) return url;
    }
  }
  return null;
}

export type PhotoLookupResult = {
  ok: boolean;
  error?: string;
  checked: number;
  found: number;
  remaining: number; // still waiting to be checked
};

export async function findProductPhotos(opts: { limit: number; timeBudgetMs: number }): Promise<PhotoLookupResult> {
  const admin = supabaseAdmin;
  if (!admin) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is missing.", checked: 0, found: 0, remaining: 0 };

  const pending = () =>
    admin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("image_url", "")
      .not("barcode", "is", null)
      .is("photo_lookup_at", null);

  const { data, error } = await admin
    .from("products")
    .select("id, barcode, category")
    .eq("image_url", "")
    .not("barcode", "is", null)
    .is("photo_lookup_at", null)
    .order("stock", { ascending: false }) // well-stocked items first
    .limit(opts.limit);
  if (error) {
    const hint = /barcode|photo_lookup_at/i.test(error.message) ? " Run supabase/product-photos.sql first." : "";
    return { ok: false, error: `Couldn't read products: ${error.message}.${hint}`, checked: 0, found: 0, remaining: 0 };
  }

  const started = Date.now();
  let checked = 0;
  let found = 0;
  for (const row of data ?? []) {
    if (Date.now() - started > opts.timeBudgetMs) break;
    const url = await findPhoto(row.barcode as string, row.category as string);
    const update: Record<string, string> = { photo_lookup_at: new Date().toISOString() };
    if (url) update.image_url = url;
    const { error: saveError } = await admin.from("products").update(update).eq("id", row.id);
    if (saveError) {
      console.error("[photo lookup] save failed", { id: row.id, error: saveError.message });
      continue;
    }
    checked++;
    if (url) found++;
  }

  const { count } = await pending();
  console.log(`[photo lookup] checked ${checked}, found ${found}, ${count ?? "?"} left`);
  return { ok: true, checked, found, remaining: count ?? 0 };
}
