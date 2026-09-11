"use client";

import { useState } from "react";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart-context";

export default function ProductCard({
  product,
  highlighted = false,
}: {
  product: Product;
  highlighted?: boolean;
}) {
  const { add } = useCart();
  const lowStock = product.stock > 0 && product.stock <= 3;
  // Product listings only ever fetch in-stock items now, but this stays as
  // a defensive fallback — e.g. if a product sells out in the moment
  // between page load and this render — so the Add button never lets
  // someone order something that isn't actually there.
  const outOfStock = product.stock === 0;

  const [justAdded, setJustAdded] = useState(false);

  const handleAdd = () => {
    add({ id: product.id, name: product.name, price: product.price });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div
      id={`product-${product.id}`}
      className={`group flex flex-col overflow-hidden rounded-lg border bg-paper transition-all duration-300 hover:-translate-y-1 hover:border-green/40 hover:shadow-lg ${
        highlighted ? "border-green shadow-lg ring-2 ring-green/30" : "border-line"
      }`}
    >
      {highlighted && (
        <div className="stripe-bar h-1" />
      )}
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={product.image_url}
          alt={product.name}
          className={`h-32 w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            outOfStock ? "grayscale" : ""
          }`}
        />
      ) : (
        <div
          className={`flex h-32 items-center justify-center font-mono text-[0.65rem] uppercase tracking-widest text-white/70 transition-transform duration-500 group-hover:scale-105 ${
            outOfStock ? "grayscale" : ""
          }`}
          style={{ backgroundColor: product.swatch }}
        >
          sample photo
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-body text-[0.95rem] font-semibold leading-snug text-ink">{product.name}</h3>
          <span className="price-tag font-mono text-sm font-semibold text-ink">
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
            onClick={handleAdd}
            className={`rounded-full px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition-all active:scale-90 disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-soft ${
              justAdded ? "bg-green-deep" : "bg-green hover:bg-green-deep"
            }`}
          >
            {justAdded ? "Added ✓" : "Add"}
          </button>
        </div>
      </div>
    </div>
  );
}
