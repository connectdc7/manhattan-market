"use client";

import { useEffect, useState } from "react";
import { categories, getProducts, Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import CategoryPills from "@/components/CategoryPills";
import Reveal from "@/components/Reveal";

export default function OrderPage() {
  const [active, setActive] = useState<(typeof categories)[number] | "All">("All");
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getProducts().then((data) => {
      if (!cancelled) {
        // Only ever show what's actually in stock — the site should always
        // match the live inventory, so a sold-out item just isn't on the
        // menu rather than sitting there unbuyable.
        setProducts(data.filter((p) => p.stock > 0));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deep-link support for links like /order#product-trail-mix (the
  // homepage's "Product of the Day" section uses this): once the catalog's
  // loaded, switch to that product's category if needed so it's actually
  // in the shown list, scroll it into view, and briefly highlight it.
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash.replace("#product-", "");
    if (!hash) return;
    const target = products.find((p) => p.id === hash);
    if (!target) return;

    setActive(target.category);
    setHighlightId(target.id);

    const timer = setTimeout(() => {
      document.getElementById(`product-${target.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 60);
    const clear = setTimeout(() => setHighlightId(null), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(clear);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const shown = active === "All" ? products : products.filter((p) => p.category === active);

  return (
    <div className="mx-auto max-w-6xl px-5 py-12">
      <p className="eyebrow text-green">Order Online</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        Pickup or delivery — your call
      </h1>
      <p className="mt-2 max-w-xl font-body text-sm text-ink-soft">
        Sample menu for this preview. Add real products, photos, and pricing before
        launch.
      </p>

      <div className="mt-8">
        <CategoryPills options={["All", ...categories] as const} active={active} onChange={setActive} />
      </div>

      {loading ? (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 animate-pulse rounded-lg border border-line bg-panel" />
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product, i) => (
            <Reveal key={product.id} delayMs={Math.min(i, 8) * 60}>
              <ProductCard product={product} highlighted={product.id === highlightId} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
