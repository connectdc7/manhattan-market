"use client";

import { useEffect, useState } from "react";
import { categories, getProducts, Product } from "@/lib/products";
import ProductCard from "@/components/ProductCard";

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

      <div className="mt-8 flex flex-wrap gap-2">
        {(["All", ...categories] as const).map((c) => (
          <button
            key={c}
            onClick={() => setActive(c)}
            className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold transition ${
              active === c
                ? "border-green bg-green text-white"
                : "border-line text-ink-soft hover:border-green hover:text-green"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 font-mono text-xs uppercase tracking-wide text-ink-soft">
          Loading menu…
        </p>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
