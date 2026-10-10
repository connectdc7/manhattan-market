"use client";

import { useEffect, useMemo, useState } from "react";
import { Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import CategoryPills from "@/components/CategoryPills";
import Reveal from "@/components/Reveal";
import { AISLES } from "@/lib/aisles";

// The interactive part of the Order page — category filtering, and the
// "jump to and highlight this product" deep link (used by the homepage's
// "Product of the Day" link, e.g. /order#product-trail-mix). Split out from
// app/order/page.tsx so that page can be a Server Component: the product
// list itself needs to be present in the server-rendered HTML — for SEO,
// and so it shows up instantly instead of only after a client-side fetch —
// while this filtering/highlighting behavior still needs to run in the
// browser. `categories` is the storefront-visible list resolved server-side
// (see lib/categories.ts's getStorefrontCategories) — not every category
// staff track internally is meant for customers to browse.
//
// The main chips are "aisles" (lib/aisles.ts) — a few friendly groups —
// rather than every Clover department; picking an aisle shows its
// departments as smaller chips underneath.
//
// The real catalog is thousands of items, so the page shows a screenful at
// a time ("Show more") and has a search box, rather than rendering every
// card at once.
const PAGE_SIZE = 60;

type StoreCategory = { name: string; aisle: string };
const ALL = "All";

export default function OrderCatalog({ products, categories }: { products: Product[]; categories: StoreCategory[] }) {
  const [active, setActive] = useState<string>(ALL); // aisle
  const [sub, setSub] = useState<string>(ALL); // department within the aisle
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);

  const aisleOf = useMemo(() => new Map(categories.map((c) => [c.name, c.aisle])), [categories]);

  // Only offer aisles/departments that actually have something in stock right now.
  const { aisles, deptsByAisle } = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    const byAisle = new Map<string, string[]>();
    for (const c of categories) {
      if (!present.has(c.name)) continue;
      byAisle.set(c.aisle, [...(byAisle.get(c.aisle) ?? []), c.name]);
    }
    for (const list of byAisle.values()) list.sort((a, b) => a.localeCompare(b));
    const ordered = (AISLES as readonly string[]).filter((a) => byAisle.has(a));
    return { aisles: ordered, deptsByAisle: byAisle };
  }, [products, categories]);
  const subOptions = active === ALL ? [] : deptsByAisle.get(active) ?? [];

  useEffect(() => {
    const hash = window.location.hash.replace("#product-", "");
    if (!hash) return;
    const target = products.find((p) => p.id === hash);
    if (!target) return;

    setActive(aisleOf.get(target.category) ?? ALL);
    setSub(target.category);
    setHighlightId(target.id);
    // Make sure the linked item is within the visible page.
    const position = products.filter((p) => p.category === target.category).findIndex((p) => p.id === target.id);
    if (position >= PAGE_SIZE) setLimit(position + 1);

    const timer = setTimeout(() => {
      document.getElementById(`product-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clear = setTimeout(() => setHighlightId(null), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matching = useMemo(() => {
    let list = products;
    if (active !== ALL) list = list.filter((p) => aisleOf.get(p.category) === active);
    if (sub !== ALL) list = list.filter((p) => p.category === sub);
    const q = search.trim().toLowerCase();
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    return list;
  }, [products, active, sub, search, aisleOf]);
  const shown = matching.slice(0, limit);

  const changeAisle = (a: string) => {
    setActive(a);
    setSub(ALL);
    setLimit(PAGE_SIZE);
  };
  const changeSub = (c: string) => {
    setSub(c);
    setLimit(PAGE_SIZE);
  };

  return (
    <>
      <div className="mt-8">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setLimit(PAGE_SIZE);
          }}
          placeholder="Search the store…"
          aria-label="Search products"
          className="w-full max-w-md rounded-full border border-line bg-paper px-5 py-2.5 font-body text-sm text-ink outline-none focus:border-green"
        />
      </div>

      <div className="mt-5">
        <CategoryPills options={[ALL, ...aisles] as const} active={active} onChange={changeAisle} />
      </div>

      {subOptions.length > 1 && (
        <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label={`${active} departments`}>
          {[ALL, ...subOptions].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => changeSub(c)}
              aria-pressed={sub === c}
              className={`rounded-full border px-3 py-1 font-body text-xs transition ${
                sub === c
                  ? "border-green bg-green-tint text-green-deep"
                  : "border-line text-ink-soft hover:border-green hover:text-green"
              }`}
            >
              {c === ALL ? `All ${active}` : c}
            </button>
          ))}
        </div>
      )}

      {matching.length === 0 ? (
        <p className="mt-10 font-body text-sm text-ink-soft">
          Nothing matches {search.trim() ? <>&ldquo;{search.trim()}&rdquo;</> : "that"} right now — try another search or category.
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product, i) => (
            <Reveal key={product.id} delayMs={Math.min(i % PAGE_SIZE, 8) * 60}>
              <ProductCard product={product} highlighted={product.id === highlightId} />
            </Reveal>
          ))}
        </div>
      )}

      {matching.length > shown.length && (
        <div className="mt-10 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="rounded-full border border-green px-6 py-2.5 font-mono text-sm font-semibold text-green transition hover:bg-green hover:text-white"
          >
            Show more
          </button>
          <p className="font-mono text-xs text-ink-soft">
            Showing {shown.length} of {matching.length}
          </p>
        </div>
      )}
    </>
  );
}
