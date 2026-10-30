// Order page search helper: products that match but are out of stock right
// now (counted at 0 in Clover), so customers see "we carry it, it's just
// sold out" instead of nothing. In-stock matches are found in the browser.
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getCategories } from "@/lib/categories";
import { rankProducts, searchWords } from "@/lib/search";

export async function GET(request: Request) {
  const q = (new URL(request.url).searchParams.get("q") ?? "").slice(0, 60);
  const words = searchWords(q).filter((w) => w.length >= 2);
  if (!supabase || words.length === 0) return NextResponse.json({ items: [] });

  const cats = await getCategories();
  const visible = cats.filter((c) => c.showOnStorefront && !c.needsReview).map((c) => c.name);
  if (visible.length === 0) return NextResponse.json({ items: [] });

  // Narrow in the database by the longest word, then rank properly here.
  const key = [...words].sort((a, b) => b.length - a.length)[0];
  const { data, error } = await supabase
    .from("products")
    .select("id, name, category, price, image_url")
    .in("category", visible)
    .lte("stock", 0)
    .eq("stock_unknown", false)
    .eq("hide_online", false)
    .ilike("name", `%${key}%`)
    .limit(200);
  if (error) return NextResponse.json({ items: [] });

  const seen = new Set<string>();
  const items = rankProducts((data ?? []) as { id: string; name: string; category: string; price: number; image_url: string | null }[], q)
    .filter((p) => {
      const k = p.name.trim().toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 8)
    .map((p) => ({ ...p, price: Number(p.price) }));
  return NextResponse.json({ items });
}
