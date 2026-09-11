// "Notify me when this is back" — captured on the storefront when a
// product's sold out, acted on from the employee dashboard. See
// supabase/seed.sql for the restock_requests table and its (deliberately
// anon-accessible, pre-login) RLS policies.
import { supabase } from "./supabase";

export async function requestRestockNotification(productId: string, contact: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("restock_requests").insert({ product_id: productId, contact });
  if (error) {
    console.error("requestRestockNotification:", error.message);
    return false;
  }
  return true;
}

// Pending (not yet notified) request count per product, for a small badge
// on the dashboard's Inventory tab — e.g. "4 waiting" next to an out-of-
// stock item.
export async function getPendingRestockCounts(): Promise<Record<string, number>> {
  if (!supabase) return {};
  const { data, error } = await supabase
    .from("restock_requests")
    .select("product_id")
    .eq("notified", false);

  if (error || !data) {
    if (error) console.error("getPendingRestockCounts:", error.message);
    return {};
  }

  const counts: Record<string, number> = {};
  for (const row of data as { product_id: string }[]) {
    counts[row.product_id] = (counts[row.product_id] ?? 0) + 1;
  }
  return counts;
}
