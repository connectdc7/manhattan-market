// Order records, written at checkout and read back by the employee
// dashboard. Payment itself is still mocked (see app/checkout/page.tsx),
// but the order record is real once Supabase is configured — this is what
// the "Recent Orders" panel on /dashboard reads from.
import { supabase } from "./supabase";

export type OrderItem = { id: string; name: string; price: number; qty: number };

export type Order = {
  id: string;
  created_at: string;
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  subtotal: number;
};

export async function createOrder(order: {
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  subtotal: number;
}) {
  if (!supabase) return;
  const { error } = await supabase.from("orders").insert(order);
  if (error) console.error("createOrder:", error.message);
}

export async function getOrders(limit = 25): Promise<Order[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, fulfillment, items, subtotal")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getOrders:", error.message);
    return [];
  }

  return data.map((row) => ({ ...row, subtotal: Number(row.subtotal) })) as Order[];
}
