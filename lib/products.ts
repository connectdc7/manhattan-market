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

export type ProductCategory = "Snacks" | "Drinks" | "Hot Food" | "Grocery";

export type Product = {
  id: string;
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  blurb: string;
  swatch: string; // placeholder tile color, used when no photo has been uploaded
  image_url?: string; // real product photo, uploaded from the dashboard — empty until staff add one
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

const PRODUCT_COLUMNS = "id, name, category, price, stock, blurb, swatch, image_url";

export async function getProducts(): Promise<Product[]> {
  if (!supabase) return fallbackProducts;

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_COLUMNS)
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

// Manual stock edit from the employee dashboard — e.g. correcting a count
// after a delivery, or after something breaks/spoils. In the real build
// this kind of adjustment would happen on the Clover terminal instead and
// flow to the site via webhook; this direct write is a stand-in for that.
export async function updateProductStock(id: string, stock: number): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("products").update({ stock }).eq("id", id);
  if (error) {
    console.error("updateProductStock:", error.message);
    return false;
  }
  return true;
}

// Turns a product name into a stable, readable id ("Trail Mix" ->
// "trail-mix-9f3c"). The random suffix avoids collisions between two
// products with the same or similar name — ids are permanent once created.
function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "product"}-${suffix}`;
}

// Uploads a staff-chosen photo to the public "product-photos" storage
// bucket (created by supabase/seed.sql) and returns its public URL, or
// null if Supabase isn't configured or the upload fails.
export async function uploadProductPhoto(file: File, idHint: string): Promise<string | null> {
  const client = supabase;
  if (!client) return null;

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${idHint}/${Date.now()}.${ext}`;
  const { error } = await client.storage.from("product-photos").upload(path, file, {
    upsert: true,
    cacheControl: "3600",
  });
  if (error) {
    console.error("uploadProductPhoto:", error.message);
    return null;
  }

  const { data } = client.storage.from("product-photos").getPublicUrl(path);
  return data.publicUrl;
}

export type NewProductInput = {
  name: string;
  category: ProductCategory;
  price: number;
  stock: number;
  blurb: string;
  photoFile?: File | null;
};

// Adds a brand-new item to the menu from the employee dashboard — e.g. a
// product Clover doesn't have yet, or (for now, before that sync exists)
// any new item at all. In the real build this would eventually be driven
// by Clover's catalog instead of typed in here.
export async function createProduct(input: NewProductInput): Promise<Product | null> {
  const client = supabase;
  if (!client) return null;

  const id = slugify(input.name);
  let image_url = "";
  if (input.photoFile) {
    const uploaded = await uploadProductPhoto(input.photoFile, id);
    if (uploaded) image_url = uploaded;
  }

  const { data, error } = await client
    .from("products")
    .insert({
      id,
      name: input.name,
      category: input.category,
      price: input.price,
      stock: Math.max(0, Math.floor(input.stock)),
      blurb: input.blurb,
      image_url,
    })
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("createProduct:", error?.message);
    return null;
  }
  return { ...data, price: Number(data.price) } as Product;
}

export type ProductEdits = {
  name: string;
  category: ProductCategory;
  price: number;
  blurb: string;
  photoFile?: File | null;
  removePhoto?: boolean;
};

// Edits an existing product's name, category, price, description, and/or
// photo from the dashboard. Stock has its own dedicated +/- control
// elsewhere in the inventory panel, so it isn't touched here.
export async function updateProduct(id: string, edits: ProductEdits): Promise<Product | null> {
  const client = supabase;
  if (!client) return null;

  const payload: Record<string, unknown> = {
    name: edits.name,
    category: edits.category,
    price: edits.price,
    blurb: edits.blurb,
  };

  if (edits.photoFile) {
    const uploaded = await uploadProductPhoto(edits.photoFile, id);
    if (uploaded) payload.image_url = uploaded;
  } else if (edits.removePhoto) {
    payload.image_url = "";
  }

  const { data, error } = await client
    .from("products")
    .update(payload)
    .eq("id", id)
    .select(PRODUCT_COLUMNS)
    .single();

  if (error || !data) {
    console.error("updateProduct:", error?.message);
    return null;
  }
  return { ...data, price: Number(data.price) } as Product;
}

// Removes a product entirely — for correcting a mistaken add, or dropping
// an item Manhattan Market no longer carries.
export async function deleteProduct(id: string): Promise<boolean> {
  const client = supabase;
  if (!client) return false;
  const { error } = await client.from("products").delete().eq("id", id);
  if (error) {
    console.error("deleteProduct:", error.message);
    return false;
  }
  return true;
}
