// "Order again" on the homepage: given the items this browser last ordered,
// returns the ones customers can still buy online right now — current name,
// price and photo, in a department that's on the website, not hidden, and in
// stock. Anything else (e.g. wine while it's off the site) is left out.
import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/products";
import { getCategories } from "@/lib/categories";

export async function POST(request: Request) {
  let body: { ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ items: [] });
  }
  const ids = (body.ids ?? []).filter((x) => typeof x === "string").slice(0, 50);
  if (ids.length === 0) return NextResponse.json({ items: [] });

  const [products, categories] = await Promise.all([getProductsByIds(ids), getCategories()]);
  const onSite = new Set(categories.filter((c) => c.showOnStorefront && !c.needsReview).map((c) => c.name));
  const restricted = new Set(categories.filter((c) => c.ageRestricted).map((c) => c.name));
  const items = products
    .filter((p) => onSite.has(p.category) && !p.hide_online && p.stock > 0)
    .map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      stock: p.stock,
      image: p.image_url || null,
      ageRestricted: restricted.has(p.category),
    }));
  return NextResponse.json({ items });
}
