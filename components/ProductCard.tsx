"use client";

import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart-context";

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const lowStock = product.stock > 0 && product.stock <= 3;
  const outOfStock = product.stock === 0;

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-line bg-paper transition hover:shadow-sm">
      <div
        className="flex h-32 items-center justify-center font-mono text-[0.65rem] uppercase tracking-widest text-white/70"
        style={{ backgroundColor: product.swatch }}
      >
        sample photo
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-body text-[0.95rem] font-semibold leading-snug text-ink">{product.name}</h3>
          <span className="whitespace-nowrap font-mono text-sm font-semibold text-ink">
            ${product.price.toFixed(2)}
          </span>
        </div>
        <p className="font-body text-xs text-ink-soft">{product.blurb}</p>

        <div className="mt-auto flex items-center justify-between pt-2">
          <span
            className={`font-mono text-[0.68rem] font-semibold uppercase tracking-wide ${
              outOfStock ? "text-ink-soft" : lowStock ? "text-[#a8461a]" : "text-green"
            }`}
          >
            {outOfStock ? "Out of stock" : lowStock ? `Only ${product.stock} left` : `${product.stock} in stock`}
          </span>
          <button
            disabled={outOfStock}
            onClick={() => add(product.id)}
            className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-soft"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
