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
import { categories, ProductCategory } from "./products";

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
        api: "https://api.clover.com",
      }
    : {
        authorize: "https://sandbox.dev.clover.com/oauth/v2/authorize",
        token: "https://apisandbox.dev.clover.com/oauth/v2/token",
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

// Clover doesn't have our fixed four categories, so map its category name
// (if any) onto the closest match, case-insensitively, and fall back to
// "Grocery" — a deliberately simple heuristic, easy to override by hand
// afterward from the dashboard's own Edit form.
export function mapCloverCategory(cloverCategoryName: string | undefined): ProductCategory {
  if (!cloverCategoryName) return "Grocery";
  const match = categories.find((c) => c.toLowerCase() === cloverCategoryName.trim().toLowerCase());
  return match ?? "Grocery";
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

export function mapCloverItemToProductFields(item: CloverItem) {
  const categoryName = item.categories?.elements?.[0]?.name;
  return {
    name: item.name?.trim() || "Untitled item",
    category: mapCloverCategory(categoryName),
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

// Inserts or updates the products row linked to this Clover item (matched
// by clover_item_id, not name — so a rename in Clover doesn't create a
// duplicate). Never touches blurb or a manually-uploaded photo, since
// Clover has no equivalent fields for either.
export async function upsertProductFromCloverItem(item: CloverItem): Promise<boolean> {
  const client = supabaseAdmin;
  if (!client) return false;

  const fields = mapCloverItemToProductFields(item);

  const { data: existing } = await client
    .from("products")
    .select("id")
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
    return !error;
  }

  const { error } = await client.from("products").insert({
    id: slugify(fields.name),
    name: fields.name,
    category: fields.category,
    price: fields.price,
    stock: fields.stock,
    blurb: "",
    clover_item_id: item.id,
  });
  return !error;
}

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
    // TEMP DEBUG: log why a fetch failed instead of swallowing it, so a
    // failed webhook-triggered item lookup shows up in Vercel logs with
    // enough detail to diagnose (401 = bad/expired token or missing
    // scope, 404 = wrong item id, etc). Safe to remove once Clover sync
    // is confirmed working end to end.
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
