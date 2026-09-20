// Server-only order/stock writes using the Supabase admin client — used
// only from the Stripe webhook (app/api/stripe/webhook/route.ts). A paid
// order has to be recorded even though there's no signed-in browser session
// behind a webhook delivery, so it can't go through lib/orders.ts's usual
// anon-key `supabase` client the way a normal checkout would.
//
// Never import this from a "use client" file — see lib/supabase-admin.ts.
import { supabaseAdmin } from "./supabase-admin";
import { OrderItem } from "./orders";

// Returns true only if this call actually inserted a new row. Stripe
// redelivers a webhook it didn't get a fast 200 for, and "just insert
// again" would double the order (and double-decrement stock) on every
// retry — so `orders.stripe_session_id` has a unique index (see
// supabase/seed.sql) and a 23505 (unique_violation) here just means "this
// session was already fulfilled," not a real error.
export async function createOrderAdmin(order: {
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  subtotal: number;
  phone?: string | null;
  stripe_session_id: string;
}): Promise<boolean> {
  const client = supabaseAdmin;
  if (!client) return false;

  const { data, error } = await client.from("orders").insert(order).select("id").maybeSingle();
  if (error) {
    if (error.code !== "23505") {
      console.error("createOrderAdmin:", error.message);
    }
    return false;
  }
  return Boolean(data);
}

export async function decrementStockAdmin(lines: { id: string; qty: number }[]): Promise<void> {
  const client = supabaseAdmin;
  if (!client) return;
  await Promise.allSettled(
    lines.map((line) => client.rpc("decrement_stock", { p_product_id: line.id, p_qty: line.qty }))
  );
}
