"use client";

import { useState } from "react";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import ProductPlaceholder from "@/components/ProductPlaceholder";

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
  const [askAge, setAskAge] = useState(false);

  const doAdd = () => {
    add({ id: product.id, name: product.name, price: product.price, ageRestricted: product.age_restricted });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
  };

  // Wine/beer: confirm 21+ once per visit before the first one goes in the cart.
  const handleAdd = () => {
    if (product.age_restricted) {
      let ok = false;
      try {
        ok = sessionStorage.getItem("mm-21-confirmed") === "1";
      } catch {
        // storage blocked — just ask
      }
      if (!ok) {
        setAskAge(true);
        return;
      }
    }
    doAdd();
  };

  const confirmAge = () => {
    try {
      sessionStorage.setItem("mm-21-confirmed", "1");
    } catch {
      // ignore
    }
    setAskAge(false);
    doAdd();
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
        <ProductPlaceholder
          name={product.name}
          category={product.category}
          swatch={product.swatch}
          grayscale={outOfStock}
          className="h-32 w-full transition-transform duration-500 group-hover:scale-105"
        />
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-body text-[0.95rem] font-semibold leading-snug text-ink">
            {product.name}
            {product.age_restricted && (
              <span className="ml-1.5 inline-block rounded bg-ink px-1.5 py-0.5 align-middle font-mono text-[0.55rem] font-semibold text-white">
                21+
              </span>
            )}
          </h3>
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

      {askAge && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={`age-${product.id}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-5"
          onClick={() => setAskAge(false)}
        >
          <div className="w-full max-w-sm rounded-lg bg-paper p-6 text-center shadow-xl" onClick={(e) => e.stopPropagation()}>
            <p id={`age-${product.id}`} className="font-display text-xl font-bold text-ink">
              Are you 21 or older?
            </p>
            <p className="mt-2 font-body text-sm text-ink-soft">
              Wine and beer are for adults 21+. You&apos;ll need to show a valid photo ID when you pick up your
              order.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmAge}
                className="rounded-full bg-green px-4 py-2.5 font-mono text-sm font-semibold text-white hover:bg-green-deep"
              >
                Yes, I&apos;m 21 or older
              </button>
              <button
                type="button"
                onClick={() => setAskAge(false)}
                className="rounded-full border border-line px-4 py-2.5 font-mono text-sm font-semibold text-ink-soft hover:text-ink"
              >
                No
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
