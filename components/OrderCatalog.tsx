"use client";

import { useEffect, useMemo, useState } from "react";
import { Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import CategoryPills from "@/components/CategoryPills";
import Reveal from "@/components/Reveal";
import { AISLES } from "@/lib/aisles";
import { splitMatches } from "@/lib/search";
import { BUSINESS } from "@/lib/site";

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

export default function OrderCatalog({
  products,
  categories,
  initialSearch = "",
  initialAisle = "",
}: {
  products: Product[];
  categories: StoreCategory[];
  initialSearch?: string;
  initialAisle?: string;
}) {
  const [active, setActive] = useState<string>(
    initialAisle && (AISLES as readonly string[]).includes(initialAisle) ? initialAisle : ALL
  ); // aisle
  const [sub, setSub] = useState<string>(ALL); // department within the aisle
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  // Matches that are out of stock right now (from /api/products/search).
  const [soldOut, setSoldOut] = useState<{ q: string; items: { id: string; name: string; price: number; image_url: string | null }[] }>({
    q: "",
    items: [],
  });

  useEffect(() => {
    const q = search.trim();
    let cancelled = false;
    const t = setTimeout(() => {
      if (q.length < 2) {
        setSoldOut({ q: "", items: [] });
        return;
      }
      fetch(`/api/products/search?q=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((b) => !cancelled && setSoldOut({ q, items: Array.isArray(b.items) ? b.items : [] }))
        .catch(() => {});
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [search]);
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

  // While searching: exact matches first ("water" → Fiji Water, Smart Water),
  // then related items (Watermelon, other things in the Water department).
  // See lib/search.ts.
  const { best, related } = useMemo(() => {
    let list = products;
    if (active !== ALL) list = list.filter((p) => aisleOf.get(p.category) === active);
    if (sub !== ALL) list = list.filter((p) => p.category === sub);
    if (!search.trim()) return { best: list, related: [] as Product[] };
    return splitMatches(list, search);
  }, [products, active, sub, search, aisleOf]);
  const matching = useMemo(() => [...best, ...related], [best, related]);
  const searching = search.trim().length > 0;
  const shown = best.slice(0, limit);
  const [relLimit, setRelLimit] = useState(12);
  const shownRelated = related.slice(0, relLimit);

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
            setRelLimit(12);
          }}
          placeholder="Search the store — chips, milk, coffee…"
          aria-label="Search products"
          className="w-full max-w-xl rounded-full border-2 border-ink bg-paper px-5 py-3 font-body text-base text-ink shadow-[4px_4px_0_var(--gold)] outline-none focus:shadow-[4px_4px_0_var(--green)]"
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
              className={`rounded-full border-2 px-3 py-1 font-body text-xs font-semibold transition ${
                sub === c
                  ? "border-ink bg-gold text-gold-ink"
                  : "border-line bg-paper text-ink-soft hover:border-ink hover:text-ink"
              }`}
            >
              {c === ALL ? `All ${active}` : c}
            </button>
          ))}
        </div>
      )}

      {searching && matching.length > 0 && (
        <h2 className="font-poster mt-8 text-3xl uppercase text-ink">
          {best.length > 0 ? (
            <>
              {best.length} match{best.length === 1 ? "" : "es"} for &ldquo;{search.trim()}&rdquo;
            </>
          ) : (
            <>No exact match for &ldquo;{search.trim()}&rdquo;</>
          )}
          {active !== ALL && <span className="font-body text-base normal-case text-ink-soft"> in {active}</span>}
        </h2>
      )}
      {matching.length === 0 ? (
        <div className="mt-10 rounded-2xl border-2 border-dashed border-ink/40 p-6">
          <p className="font-poster text-2xl uppercase text-ink">
            {search.trim() ? <>No &ldquo;{search.trim()}&rdquo; in stock right now</> : "Nothing here right now"}
          </p>
          <p className="mt-2 font-body text-sm text-ink-soft">
            {active !== ALL ? (
              <>
                Try searching all aisles —{" "}
                <button type="button" onClick={() => changeAisle(ALL)} className="font-semibold text-green-deep underline">
                  show everything
                </button>
                . Or call{" "}
              </>
            ) : (
              <>Try a different word (e.g. a brand), or call </>
            )}
            <a href={`tel:${BUSINESS.telephone}`} className="font-semibold text-green-deep underline">
              {BUSINESS.telephoneDisplay}
            </a>{" "}
            — the store may have it on the shelf.
          </p>
        </div>
      ) : (
        shown.length > 0 && (
          <div className={`grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 ${searching ? "mt-4" : "mt-8"}`}>
            {shown.map((product, i) =>
              searching ? (
                <ProductCard key={product.id} product={product} highlighted={product.id === highlightId} />
              ) : (
                <Reveal key={product.id} delayMs={Math.min(i % PAGE_SIZE, 8) * 60}>
                  <ProductCard product={product} highlighted={product.id === highlightId} />
                </Reveal>
              )
            )}
          </div>
        )
      )}

      {best.length > shown.length && (
        <div className="mt-10 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => setLimit((n) => n + PAGE_SIZE)}
            className="shadow-sticker rounded-full border-2 border-ink bg-gold px-7 py-3 font-mono text-sm font-bold uppercase tracking-wide text-gold-ink transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
          >
            Show more
          </button>
          <p className="font-mono text-xs text-ink-soft">
            Showing {shown.length} of {best.length}
          </p>
        </div>
      )}

      {searching && related.length > 0 && (
        <section className={best.length > 0 ? "mt-14 border-t-2 border-dashed border-ink/30 pt-10" : "mt-4"}>
          <h3 className="font-poster text-2xl uppercase text-ink">
            {best.length > 0 ? "Related items" : "Closest matches"}{" "}
            <span className="font-body text-base normal-case text-ink-soft">({related.length})</span>
          </h3>
          <p className="mt-1 font-body text-sm text-ink-soft">Similar names, or from the same department.</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {shownRelated.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {related.length > shownRelated.length && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => setRelLimit((n) => n + 24)}
                className="rounded-full border-2 border-ink bg-paper px-6 py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-ink transition hover:bg-gold-tint"
              >
                Show more related ({related.length - shownRelated.length})
              </button>
            </div>
          )}
        </section>
      )}
      {search.trim() && soldOut.q === search.trim() && soldOut.items.length > 0 && (
        <section className="mt-12">
          <h3 className="font-poster text-2xl uppercase text-ink">Out of stock right now</h3>
          <p className="mt-1 font-body text-sm text-ink-soft">
            We carry these, but they&apos;re sold out at the moment. Check back soon, or call {BUSINESS.telephoneDisplay}.
          </p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {soldOut.items.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border-2 border-line bg-panel p-3 opacity-80">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt="" className="h-full w-full object-contain grayscale" />
                  ) : (
                    <span className="font-poster text-base uppercase text-ink/30">{p.name.slice(0, 2)}</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block font-body text-sm font-semibold text-ink-soft">{p.name}</span>
                  <span className="font-mono text-[0.6rem] font-bold uppercase text-[#a8461a]">Sold out</span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
