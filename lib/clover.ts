// Shared Clover API helpers, used only from server-side route handlers
// (app/api/clover/**). Nothing here should ever be imported from a "use
// client" file — CLOVER_APP_SECRET and merchant access tokens must stay on
// the server.
//
// This is "ready to connect," not connected: every function here is inert
// until CLOVER_APP_ID / CLOVER_APP_SECRET are set as environment variables
// (see README). Point of reference for the exact request/response shapes:
// Clover's own developer docs at docs.clover.com/dev.
import { supabaseAdmin } from "./supabase-admin";

export type CloverEnv = "sandbox" | "production";

function cloverEnv(): CloverEnv {
  return process.env.CLOVER_ENV === "production" ? "production" : "sandbox";
}

export function isCloverConfigured(): boolean {
  return Boolean(process.env.CLOVER_APP_ID && process.env.CLOVER_APP_SECRET);
}

// Sandbox and production Clover accounts live on different hosts entirely —
// there's no single base URL that works for both.
export function cloverUrls() {
  return cloverEnv() === "production"
    ? {
        authorize: "https://www.clover.com/oauth/v2/authorize",
        token: "https://api.clover.com/oauth/v2/token",
        refresh: "https://api.clover.com/oauth/v2/refresh",
        api: "https://api.clover.com",
      }
    : {
        authorize: "https://sandbox.dev.clover.com/oauth/v2/authorize",
        token: "https://apisandbox.dev.clover.com/oauth/v2/token",
        refresh: "https://apisandbox.dev.clover.com/oauth/v2/refresh",
        api: "https://apisandbox.dev.clover.com",
      };
}

export type CloverConnection = {
  merchant_id: string;
  access_token: string;
  refresh_token: string | null;
  access_token_expiration: number | null;
  connected_at: string;
};

// Clover's v2/OAuth "expiring token" flow (what /api/clover/callback uses)
// issues an access token good for a matter of hours, plus a refresh token
// that's good for much longer but is single-use — trading it in gets a
// brand-new access+refresh pair, and the old refresh token stops working
// the instant that happens. Nothing previously called this, which is why
// a connection would work right after "Connect"/"Sync Now" and then start
// silently 401ing on every Clover API call once the access token expired.
async function refreshCloverAccessToken(connection: CloverConnection): Promise<CloverConnection | null> {
  if (!connection.refresh_token) return null;

  const res = await fetch(cloverUrls().refresh, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.CLOVER_APP_ID,
      refresh_token: connection.refresh_token,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    console.error("[clover] token refresh failed", { status: res.status, detail });
    return null;
  }

  const body = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    access_token_expiration?: number;
    refresh_token_expiration?: number;
  };
  if (!body.access_token) return null;

  const saved = await saveCloverConnection({
    merchant_id: connection.merchant_id,
    access_token: body.access_token,
    // Clover may not always send a new refresh_token back; keep the old
    // one only as a last resort (it may already be spent).
    refresh_token: body.refresh_token ?? connection.refresh_token,
    access_token_expiration: body.access_token_expiration ?? null,
    refresh_token_expiration: body.refresh_token_expiration ?? null,
  });
  if (!saved) return null;

  return {
    ...connection,
    access_token: body.access_token,
    refresh_token: body.refresh_token ?? connection.refresh_token,
    access_token_expiration: body.access_token_expiration ?? null,
  };
}

// What every route should call instead of getCloverConnection() directly —
// refreshes the access token first when it's expired or about to be
// (60s buffer for clock skew / request latency), so callers never have to
// think about token lifetime themselves. Falls back to the possibly-stale
// connection if a refresh attempt fails, so the caller's existing
// error handling (e.g. fetchCloverItem's 401 logging) still surfaces the
// problem instead of this failing silently.
export async function getFreshCloverConnection(): Promise<CloverConnection | null> {
  const connection = await getCloverConnection();
  if (!connection) return null;

  const nowSec = Date.now() / 1000;
  const expiresSoon =
    typeof connection.access_token_expiration === "number" &&
    connection.access_token_expiration - nowSec < 60;

  if (!expiresSoon) return connection;

  const refreshed = await refreshCloverAccessToken(connection);
  return refreshed ?? connection;
}

// This demo supports connecting exactly one Clover merchant (Manhattan
// Market's own store) — enough for one physical location. Multi-location
// support would key connections by something the dashboard lets staff pick.
export async function getCloverConnection(): Promise<CloverConnection | null> {
  const client = supabaseAdmin;
  if (!client) return null;
  const { data, error } = await client
    .from("clover_connections")
    .select("merchant_id, access_token, refresh_token, access_token_expiration, connected_at")
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as CloverConnection;
}

export async function saveCloverConnection(input: {
  merchant_id: string;
  access_token: string;
  refresh_token?: string | null;
  access_token_expiration?: number | null;
  refresh_token_expiration?: number | null;
}): Promise<boolean> {
  const client = supabaseAdmin;
  if (!client) return false;
  const { error } = await client.from("clover_connections").upsert(
    {
      merchant_id: input.merchant_id,
      access_token: input.access_token,
      refresh_token: input.refresh_token ?? null,
      access_token_expiration: input.access_token_expiration ?? null,
      refresh_token_expiration: input.refresh_token_expiration ?? null,
      connected_at: new Date().toISOString(),
    },
    { onConflict: "merchant_id" }
  );
  return !error;
}

export async function deleteCloverConnection(): Promise<boolean> {
  const client = supabaseAdmin;
  if (!client) return false;
  const { error } = await client.from("clover_connections").delete().neq("merchant_id", "");
  return !error;
}

// Category resolution for a synced Clover item. Categories aren't a fixed
// list anymore (see lib/categories.ts) — Clover's own department names are
// the source of truth, and this maps each one onto our `categories` table:
//
//   1. Already resolved before (an alias row exists, from either an earlier
//      sync or a staffer's rename/merge) — reuse that, unchanged.
//   2. Not aliased yet, but the name matches one of ours exactly
//      (case-insensitively) — e.g. Clover literally calls it "Drinks".
//      Link it up with no review needed; this is the common case once
//      staff have been through the review queue once.
//   3. Genuinely new — create the category now (so the item isn't stuck
//      waiting on a human before it can be synced at all), flagged
//      needs_review = true and show_on_storefront = false. It shows up in
//      the dashboard's review queue (CategoryReviewPanel) for staff to
//      confirm, rename, merge into an existing category, or show on the
//      storefront.
//
// `CloverCategoryContext` is loaded once per sync run (a full "Sync Now"
// pull, or one webhook delivery covering several item events) via
// loadCloverCategoryContext(), then threaded through every
// upsertProductFromCloverItem call in that run — so resolving each item's
// category is an in-memory lookup, not a database round trip per item, and
// two items in the same run introducing the same new department only
// create one category row, not two.
export type CloverCategoryContext = {
  // normalized (trimmed, lowercased) Clover department name -> our
  // category's actual name.
  aliasToCategory: Map<string, string>;
  // normalized (trimmed, lowercased) category name -> its actual name —
  // for the case-insensitive exact-match check in step 2 above.
  nameByLower: Map<string, string>;
};

function normalizeCategoryName(raw: string): string {
  return raw.trim().toLowerCase();
}

export async function loadCloverCategoryContext(): Promise<CloverCategoryContext> {
  const ctx: CloverCategoryContext = { aliasToCategory: new Map(), nameByLower: new Map() };
  const client = supabaseAdmin;
  if (!client) return ctx;

  const [{ data: aliases }, { data: cats }] = await Promise.all([
    client.from("category_aliases").select("clover_name, category_name"),
    client.from("categories").select("name"),
  ]);
  for (const row of aliases ?? []) ctx.aliasToCategory.set(row.clover_name, row.category_name);
  for (const row of cats ?? []) ctx.nameByLower.set(normalizeCategoryName(row.name), row.name);
  return ctx;
}

export async function resolveCloverCategory(
  cloverCategoryName: string | undefined,
  ctx: CloverCategoryContext
): Promise<string> {
  const raw = (cloverCategoryName ?? "").trim();
  if (!raw) return "Grocery";
  const key = normalizeCategoryName(raw);

  const aliased = ctx.aliasToCategory.get(key);
  if (aliased) return aliased;

  const client = supabaseAdmin;
  if (!client) return "Grocery";

  const exact = ctx.nameByLower.get(key);
  if (exact) {
    // Not previously aliased, but matches an existing category by name —
    // link it up (ignoreDuplicates covers two items in this same run
    // hitting this exact path at once) so future syncs skip straight to
    // the fast path above.
    const { error } = await client
      .from("category_aliases")
      .upsert({ clover_name: key, category_name: exact }, { onConflict: "clover_name", ignoreDuplicates: true });
    if (error) console.error("[clover] category alias link failed", { raw, exact, error });
    ctx.aliasToCategory.set(key, exact);
    return exact;
  }

  // Genuinely new — create it (hidden + flagged for review) and remember
  // the alias so a rename later doesn't make this look new again.
  const { error: categoryError } = await client
    .from("categories")
    .upsert({ name: raw, needs_review: true, show_on_storefront: false }, { onConflict: "name", ignoreDuplicates: true });
  if (categoryError) console.error("[clover] category create failed", { raw, categoryError });

  const { error: aliasError } = await client
    .from("category_aliases")
    .upsert({ clover_name: key, category_name: raw }, { onConflict: "clover_name", ignoreDuplicates: true });
  if (aliasError) console.error("[clover] category alias create failed", { raw, aliasError });

  ctx.aliasToCategory.set(key, raw);
  ctx.nameByLower.set(key, raw);
  return raw;
}

// Raw shape of the bits of a Clover item we actually use. Clover's real
// item object has many more fields; we only read what maps onto our
// products table.
export type CloverItem = {
  id: string;
  name?: string;
  price?: number; // cents
  hidden?: boolean;
  categories?: { elements?: { name?: string }[] };
  itemStock?: { quantity?: number };
};

export async function mapCloverItemToProductFields(item: CloverItem, ctx: CloverCategoryContext) {
  const categoryName = item.categories?.elements?.[0]?.name;
  return {
    name: item.name?.trim() || "Untitled item",
    category: await resolveCloverCategory(categoryName, ctx),
    price: typeof item.price === "number" ? Math.max(0, item.price) / 100 : 0,
    stock: typeof item.itemStock?.quantity === "number" ? Math.max(0, item.itemStock.quantity) : 0,
  };
}

// Turns a Clover item name into the same kind of readable id our own
// "Add Product" form generates, so Clover-sourced and hand-added products
// look consistent in the products table.
function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "product"}-${suffix}`;
}

export type CloverUpsertResult = {
  ok: boolean;
  id: string | null;
  name: string;
  category: string;
  // True when this item still has no photo at all after the upsert (new
  // from Clover, or synced before an OPENAI_API_KEY was set) — the caller
  // decides whether/when to actually generate one, see
  // generatePhotosForItems below. Kept separate from the upsert itself so
  // a sync pulling in a big catalog isn't stuck generating photos one at a
  // time inside this loop; see README's "AI-generated product photos".
  needsPhoto: boolean;
};

// Inserts or updates the products row linked to this Clover item (matched
// by clover_item_id, not name — so a rename in Clover doesn't create a
// duplicate). Never touches blurb or a manually-uploaded photo, since
// Clover has no equivalent fields for either.
export async function upsertProductFromCloverItem(
  item: CloverItem,
  ctx: CloverCategoryContext
): Promise<CloverUpsertResult> {
  const client = supabaseAdmin;
  const fields = await mapCloverItemToProductFields(item, ctx);
  const empty: CloverUpsertResult = { ok: false, id: null, name: fields.name, category: fields.category, needsPhoto: false };
  if (!client) return empty;

  const { data: existing } = await client
    .from("products")
    .select("id, image_url")
    .eq("clover_item_id", item.id)
    .maybeSingle();

  if (existing) {
    const { error } = await client
      .from("products")
      .update({
        name: fields.name,
        category: fields.category,
        price: fields.price,
        stock: fields.stock,
      })
      .eq("id", existing.id);
    // Logged (not just swallowed) since a write failing here — RLS, a
    // constraint, a schema mismatch — has no other visible symptom: the
    // webhook/sync still responds 200 and the caller only sees `saved: false`.
    if (error) console.error("[clover] products update failed", { itemId: item.id, existingId: existing.id, error });
    return {
      ok: !error,
      id: error ? null : existing.id,
      name: fields.name,
      category: fields.category,
      needsPhoto: !error && !existing.image_url,
    };
  }

  const newId = slugify(fields.name);
  const { error } = await client.from("products").insert({
    id: newId,
    name: fields.name,
    category: fields.category,
    price: fields.price,
    stock: fields.stock,
    blurb: "",
    clover_item_id: item.id,
  });
  if (error) {
    console.error("[clover] products insert failed", { itemId: item.id, fields, error });
    return empty;
  }
  return { ok: true, id: newId, name: fields.name, category: fields.category, needsPhoto: true };
}

// Photo generation itself (generateAndSavePhoto, generatePhotosForItems)
// lives in lib/image-gen.ts — it's no longer Clover-specific, since the
// "generate missing photos" sweep in /api/products/generate-missing-photos
// runs it over the whole products table, not just items synced from
// Clover. See that file and README's "AI-generated product photos".

export async function deleteProductByCloverItemId(cloverItemId: string): Promise<boolean> {
  const client = supabaseAdmin;
  if (!client) return false;
  const { error } = await client.from("products").delete().eq("clover_item_id", cloverItemId);
  return !error;
}

// Fetches a single item (with its category + stock) straight from Clover's
// API — used by both the manual "Sync Now" pull and the webhook handler.
export async function fetchCloverItem(
  merchantId: string,
  accessToken: string,
  itemId: string
): Promise<CloverItem | null> {
  const res = await fetch(
    `${cloverUrls().api}/v3/merchants/${merchantId}/items/${itemId}?expand=categories,itemStock`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    // Logged for the same reason as the upsert errors above: 401 usually
    // means an expired/bad token, 404 usually means a stale item id — both
    // otherwise look identical to a shopper-facing "nothing happened".
    const detail = await res.text().catch(() => "");
    console.error("[clover] fetchCloverItem failed", { itemId, status: res.status, detail });
    return null;
  }
  return (await res.json()) as CloverItem;
}

// The verification code Clover POSTs when a webhook URL is first entered in
// the developer dashboard — staff need to see it in the UI to paste it back
// into Clover's "Verify" step. Also doubles as a quick "is anything
// actually arriving?" signal (last_event_at) once real events start.
export async function recordWebhookVerification(code: string): Promise<void> {
  await supabaseAdmin?.from("clover_webhook_state").upsert({ id: "singleton", last_verification_code: code });
}

export async function recordWebhookEvent(): Promise<void> {
  await supabaseAdmin?.from("clover_webhook_state").upsert({
    id: "singleton",
    last_event_at: new Date().toISOString(),
  });
}

export async function getWebhookState(): Promise<{
  lastVerificationCode: string | null;
  lastEventAt: string | null;
} | null> {
  const client = supabaseAdmin;
  if (!client) return null;
  const { data } = await client
    .from("clover_webhook_state")
    .select("last_verification_code, last_event_at")
    .eq("id", "singleton")
    .maybeSingle();
  if (!data) return { lastVerificationCode: null, lastEventAt: null };
  return { lastVerificationCode: data.last_verification_code, lastEventAt: data.last_event_at };
}

export async function fetchAllCloverItems(
  merchantId: string,
  accessToken: string
): Promise<CloverItem[]> {
  const items: CloverItem[] = [];
  const limit = 100;
  let offset = 0;

  for (;;) {
    const res = await fetch(
      `${cloverUrls().api}/v3/merchants/${merchantId}/items?expand=categories,itemStock&limit=${limit}&offset=${offset}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) break;
    const body = (await res.json()) as { elements?: CloverItem[] };
    const page = body.elements ?? [];
    items.push(...page);
    if (page.length < limit) break;
    offset += limit;
    if (offset > 5000) break; // sanity cap — a convenience store's catalog won't get near this
  }

  return items;
}
