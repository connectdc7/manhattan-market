"use client";

import { useEffect, useState } from "react";
import { Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";
import CategoryPills from "@/components/CategoryPills";
import Reveal from "@/components/Reveal";

// The interactive part of the Order page — category filtering, and the
// "jump to and highlight this product" deep link (used by the homepage's
// "Product of the Day" link, e.g. /order#product-trail-mix). Split out from
// app/order/page.tsx so that page can be a Server Component: the product
// list itself needs to be present in the server-rendered HTML — for SEO,
// and so it shows up instantly instead of only after a client-side fetch —
// while this filtering/highlighting behavior still needs to run in the
// browser. `categories` is the storefront-visible list resolved server-side
// (see lib/categories.ts's getStorefrontCategoryNames) — not every category
// staff track internally is meant for customers to browse.
export default function OrderCatalog({ products, categories }: { products: Product[]; categories: string[] }) {
  const [active, setActive] = useState<string>("All");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  const shown = active === "All" ? products : products.filter((p) => p.category === active);

  return (
    <>
      <div className="mt-8">
        <CategoryPills options={["All", ...categories] as const} active={active} onChange={setActive} />
      </div>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((product, i) => (
          <Reveal key={product.id} delayMs={Math.min(i, 8) * 60}>
            <ProductCard product={product} highlighted={product.id === highlightId} />
          </Reveal>
        ))}
      </div>
    </>
  );
}
