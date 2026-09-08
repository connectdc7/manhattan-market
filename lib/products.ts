// Product data access.
//
// getProducts() reads from Supabase (table: products) when it's configured,
// and falls back to the local sample catalog below when it isn't — so the
// site works before and after Supabase is wired up.
//
// In the real build, the `products` table itself is kept in sync with
// Clover's inventory via webhooks (see the plan doc). For this preview, the
// table is seeded once from supabase/seed.sql with the same numbers below,
// standing in for a live count mirrored from the Clover terminal.
import { supabase } from "./supabase";

export type Product = {
  id: string;
  name: string;
  category: "Snacks" | "Drinks" | "Hot Food" | "Grocery";
  price: number;
  stock: number;
  blurb: string;
  swatch: string; // placeholder tile color, stands in for a real product photo
};

export const fallbackProducts: Product[] = [
  { id: "hot-coffee", name: "Fresh Brewed Coffee", category: "Hot Food", price: 2.25, stock: 24, blurb: "Hot, ready, and refilled all day.", swatch: "#6b4226" },
  { id: "bacon-egg-sandwich", name: "Bacon, Egg & Cheese", category: "Hot Food", price: 5.5, stock: 9, blurb: "Made fresh at the counter every morning.", swatch: "#c98b3a" },
  { id: "chicken-empanada", name: "Chicken Empanada", category: "Hot Food", price: 3.25, stock: 14, blurb: "Two in a bag, always warm.", swatch: "#d97b3f" },
  { id: "chips-classic", name: "Classic Potato Chips", category: "Snacks", price: 2.0, stock: 31, blurb: "The everyday bag by the register.", swatch: "#e0a938" },
  { id: "chocolate-bar", name: "Chocolate Bar", category: "Snacks", price: 1.75, stock: 42, blurb: "Impulse-buy shelf favorite.", swatch: "#5a3825" },
  { id: "trail-mix", name: "Trail Mix", category: "Snacks", price: 3.5, stock: 6, blurb: "Nuts, raisins, chocolate chips.", swatch: "#8a6a3f" },
  { id: "cold-brew", name: "Bottled Cold Brew", category: "Drinks", price: 3.75, stock: 18, blurb: "Straight from the cooler.", swatch: "#3a2a1e" },
  { id: "orange-juice", name: "Orange Juice, 16oz", category: "Drinks", price: 2.5, stock: 22, blurb: "Squeezed, not from concentrate.", swatch: "#e8912a" },
  { id: "sparkling-water", name: "Sparkling Water", category: "Drinks", price: 1.5, stock: 2, blurb: "Almost out — restocking Thursday.", swatch: "#7fa6a3" },
  { id: "energy-drink", name: "Energy Drink", category: "Drinks", price: 3.0, stock: 27, blurb: "The one everyone grabs before work.", swatch: "#3e6b4a" },
  { id: "milk-half-gallon", name: "Milk, Half Gallon", category: "Grocery", price: 3.25, stock: 11, blurb: "Whole, 2%, and skim in the cooler.", swatch: "#e8e4d8" },
  { id: "bread-loaf", name: "White Bread Loaf", category: "Grocery", price: 3.0, stock: 8, blurb: "Fresh delivery every other day.", swatch: "#d9b978" },
];

export const categories = ["Hot Food", "Snacks", "Drinks", "Grocery"] as const;

export async function getProducts(): Promise<Product[]> {
  if (!supabase) return fallbackProducts;

  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, price, stock, blurb, swatch")
    .order("name");

  if (error || !data || data.length === 0) {
    if (error) console.error("getProducts: falling back to sample data —", error.message);
    return fallbackProducts;
  }

  return data.map((row) => ({ ...row, price: Number(row.price) })) as Product[];
}

// Best-effort stock decrement after a (mocked) order is placed. Calls a
// Postgres function (see supabase/seed.sql) that does the subtraction
// atomically in the database, rather than a read-then-write from the
// browser — the same race-condition concern that applies to the real
// Clover sync. Silently no-ops if Supabase isn't configured, since this is
// a nice-to-have for the demo, not something that should block checkout.
export async function decrementStock(lines: { id: string; qty: number }[]) {
  const client = supabase;
  if (!client) return;
  await Promise.allSettled(
    lines.map((line) =>
      client.rpc("decrement_stock", { p_product_id: line.id, p_qty: line.qty })
    )
  );
}
