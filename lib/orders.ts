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
  phone?: string | null;
};

export async function createOrder(order: {
  fulfillment: "pickup" | "delivery";
  items: OrderItem[];
  subtotal: number;
  phone?: string | null;
}) {
  if (!supabase) return;
  const { error } = await supabase.from("orders").insert(order);
  if (error) console.error("createOrder:", error.message);
}

// 300 (rather than a smaller number) so the dashboard's analytics tab has
// enough history for a "today vs. yesterday" comparison and a same-day
// hourly breakdown even on a busy day, without needing a second query.
export async function getOrders(limit = 300): Promise<Order[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("orders")
    .select("id, created_at, fulfillment, items, subtotal, status, phone")
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

// A single count, not the order contents — used on the public storefront to
// show a live "X orders ahead of you" estimate without exposing anything
// about what's actually in those orders.
export async function getActiveOrderCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .neq("status", "completed");
  if (error) {
    console.error("getActiveOrderCount:", error.message);
    return 0;
  }
  return count ?? 0;
}

// Best-effort text to the customer when their order's marked Ready. Only
// fires when they left a phone number, and only actually sends once Twilio
// is configured (see lib/twilio.ts / the README's SMS section) — otherwise
// this silently no-ops, the same way Clover sync no-ops until connected.
export async function notifyOrderReady(orderId: string, phone?: string | null) {
  if (!phone) return;
  try {
    await fetch("/api/notify/order-ready", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, phone }),
    });
  } catch {
    // best-effort — an order still gets marked Ready even if this fails
  }
}
