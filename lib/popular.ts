// "Popular right now" on the homepage: what online customers ordered most
// in the last few weeks, topped up with specials and well-stocked items that
// have a real photo. Server-only (reads orders with the service role).
import { supabaseAdmin } from "./supabase-admin";
import type { Product } from "./products";

const DAYS = 45;

export async function getPopularProducts(products: Product[], limit = 12): Promise<Product[]> {
  const byId = new Map(products.map((p) => [p.id, p]));
  const counts = new Map<string, number>();

  if (supabaseAdmin) {
    const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
    const { data } = await supabaseAdmin.from("orders").select("items").gte("created_at", since).limit(1000);
    for (const row of data ?? []) {
      for (const item of (row.items as { id: string; qty: number }[] | null) ?? []) {
        if (byId.has(item.id)) counts.set(item.id, (counts.get(item.id) ?? 0) + (Number(item.qty) || 1));
      }
    }
  }

  const picked: Product[] = [];
  const seen = new Set<string>();
  const push = (p: Product | undefined) => {
    if (!p || seen.has(p.id) || p.stock <= 0 || picked.length >= limit) return;
    seen.add(p.id);
    picked.push(p);
  };

  [...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([id]) => push(byId.get(id)));
  products.filter((p) => p.is_special).forEach(push);
  products
    .filter((p) => p.image_url && !p.age_restricted)
    .sort((a, b) => b.stock - a.stock)
    .forEach(push);
  products.forEach(push);
  return picked;
}
