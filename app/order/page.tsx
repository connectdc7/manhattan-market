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

  useEffect(() => {
    let cancelled = false;
    getProducts().then((data) => {
      if (!cancelled) {
        setProducts(data);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
              <ProductCard product={product} />
            </Reveal>
          ))}
        </div>
      )}
    </div>
  );
}
