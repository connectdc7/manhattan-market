// Subscribes the dashboard to live changes on the tables it cares about, so
// a new order, a stock edit (from this tab or any other), or a rewards
// signup shows up without a manual refresh. Requires the tables to be added
// to the `supabase_realtime` publication — supabase/seed.sql does that.
import { supabase } from "./supabase";

export function subscribeToDashboardChanges(onChange: () => void): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client
    .channel("dashboard-live")
    .on("postgres_changes", { event: "*", schema: "public", table: "products" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "rewards_signups" }, onChange)
    .on("postgres_changes", { event: "*", schema: "public", table: "restock_requests" }, onChange)
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
