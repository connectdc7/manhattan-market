// Order records, written at checkout and read/managed by the employee
// dashboard. Payment itself is still mocked (see app/checkout/page.tsx),
// but the order record — including its status — is real once Supabase is
// configured.
import { supabase } from "./supabase";

export type OrderItem = { id: string; name: string; price: number; qty: number };

export type OrderStatus = "new" | "preparing" | "ready" | "completed";

export const ORDER_STATUSES: OrderStatus[] = ["new", "preparing", "ready", "completed"];

export type Order = {
  id: string;
  created_at: string;
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
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

export async function getOrders(limit = 100): Promise<Order[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, fulfillment, items, subtotal, status")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    if (error) console.error("getOrders:", error.message);
    return [];
  }

  return data.map((row) => ({
    ...row,
    subtotal: Number(row.subtotal),
    status: (row.status ?? "new") as OrderStatus,
  })) as Order[];
}

export async function updateOrderStatus(id: string, status: OrderStatus): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) {
    console.error("updateOrderStatus:", error.message);
    return false;
  }
  return true;
}
