// Keeps the website's menu in step with Clover when connected by API token
// (which can't receive Clover's webhooks). Called after storefront and
// dashboard page loads: at most once every AUTO_SYNC_MINUTES it pulls the
// whole Clover catalog — prices, stock, names, categories — in the
// background, after the page has already been sent, so customers never wait
// on it. In-store sales on the Clover terminal show up on the website within
// a few minutes of the next visit.
//
// The "only once every N minutes" claim is done atomically in the database
// (clover_webhook_state.last_auto_sync_at, supabase/clover-token.sql), so
// many visitors at once still trigger just one sync.
import { supabaseAdmin } from "./supabase-admin";
import {
  fetchAllCloverItems,
  getFreshCloverConnection,
  isCloverTokenMode,
  loadCloverCategoryContext,
  upsertProductFromCloverItem,
} from "./clover";

const AUTO_SYNC_MINUTES = 3;

export async function maybeAutoSyncClover(): Promise<void> {
  if (!isCloverTokenMode()) return; // OAuth mode uses webhooks instead
  const admin = supabaseAdmin;
  if (!admin) return;

  try {
    await admin.from("clover_webhook_state").upsert({ id: "singleton" }, { onConflict: "id", ignoreDuplicates: true });
    const now = new Date();
    const cutoff = new Date(now.getTime() - AUTO_SYNC_MINUTES * 60_000).toISOString();
    const { data: claimed, error } = await admin
      .from("clover_webhook_state")
      .update({ last_auto_sync_at: now.toISOString() })
      .eq("id", "singleton")
      .or(`last_auto_sync_at.is.null,last_auto_sync_at.lt.${cutoff}`)
      .select("id");
    if (error) {
      console.error("[clover autosync] claim failed — has supabase/clover-token.sql been run?", error.message);
      return;
    }
    if (!claimed || claimed.length === 0) return; // synced recently

    const connection = await getFreshCloverConnection();
    if (!connection) return;
    const items = await fetchAllCloverItems(connection.merchant_id, connection.access_token);
    const ctx = await loadCloverCategoryContext();
    let ok = 0;
    for (const item of items) {
      const result = await upsertProductFromCloverItem(item, ctx);
      if (result.ok) ok++;
    }
    console.log(`[clover autosync] synced ${ok}/${items.length} items`);
  } catch (err) {
    console.error("[clover autosync] failed", err);
  }
}
