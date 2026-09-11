"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

type SavedOrder = {
  items: { id: string; name: string; price: number; qty: number }[];
  at: number;
};

const STORAGE_KEY = "mm_last_order";

// Saved by app/checkout/page.tsx the moment an order's placed. No accounts,
// no login — just "the last thing this browser ordered," which is enough
// for a one-click reorder without building out real customer profiles.
export function saveLastOrder(items: SavedOrder["items"]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, at: Date.now() }));
  } catch {
    // ignore — reorder is a convenience, not something to ever block on
  }
}

export default function ReorderCard() {
  const { add } = useCart();
  const [saved, setSaved] = useState<SavedOrder | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setSaved(JSON.parse(raw));
    } catch {
      // ignore — just means no reorder card shows
    }
  }, []);

  if (!saved || saved.items.length === 0) return null;

  const handleReorder = () => {
    for (const item of saved.items) {
      for (let i = 0; i < item.qty; i++) {
        add({ id: item.id, name: item.name, price: item.price });
      }
    }
    setAdded(true);
  };

  return (
    <section className="border-b border-line bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-line bg-panel px-6 py-5">
          <div>
            <p className="eyebrow text-green">Order again</p>
            <p className="mt-1 font-body text-sm text-ink">
              {saved.items.map((i) => `${i.name} × ${i.qty}`).join(", ")}
            </p>
          </div>
          <button
            onClick={handleReorder}
            className="whitespace-nowrap rounded-full bg-green px-5 py-2.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
          >
            {added ? "Added to cart ✓" : "Reorder — Add to Cart"}
          </button>
        </div>
      </div>
    </section>
  );
}
