"use client";

import { useState } from "react";
import { Product } from "@/lib/products";
import { useCart } from "@/lib/cart-context";
import { requestRestockNotification } from "@/lib/restock";

export default function ProductCard({ product }: { product: Product }) {
  const { add } = useCart();
  const lowStock = product.stock > 0 && product.stock <= 3;
  const outOfStock = product.stock === 0;

  const [notifyOpen, setNotifyOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [notifyState, setNotifyState] = useState<"idle" | "saving" | "done">("idle");
  const [justAdded, setJustAdded] = useState(false);

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setNotifyState("saving");
    const ok = await requestRestockNotification(product.id, email.trim());
    setNotifyState(ok ? "done" : "idle");
  };

  const handleAdd = () => {
    add({ id: product.id, name: product.name, price: product.price });
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 900);
  };

  return (
    <div className="group flex flex-col overflow-hidden rounded-lg border border-line bg-paper transition-all duration-300 hover:-translate-y-1 hover:border-green/40 hover:shadow-lg">
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

        {outOfStock && (
          <div className="mt-1 border-t border-line pt-2">
            {notifyState === "done" ? (
              <p className="font-body text-xs text-green">We'll email you when it's back.</p>
            ) : notifyOpen ? (
              <form onSubmit={handleNotifySubmit} className="flex items-center gap-1.5">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@email.com"
                  className="w-full min-w-0 rounded border border-line bg-paper px-2 py-1 font-body text-xs text-ink outline-none focus:border-green"
                />
                <button
                  type="submit"
                  disabled={notifyState === "saving"}
                  className="whitespace-nowrap rounded-full border border-line px-2.5 py-1 font-mono text-[0.65rem] font-semibold text-ink-soft transition hover:border-green hover:text-green disabled:opacity-60"
                >
                  {notifyState === "saving" ? "…" : "Notify me"}
                </button>
              </form>
            ) : (
              <button
                onClick={() => setNotifyOpen(true)}
                className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-green"
              >
                Notify me when it's back
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
