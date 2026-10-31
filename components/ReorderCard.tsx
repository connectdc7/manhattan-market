"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart-context";

type SavedOrder = {
  items: { id: string; name: string; price: number; qty: number }[];
  at: number;
};

type Available = { id: string; name: string; price: number; stock: number; image: string | null; ageRestricted: boolean };

const STORAGE_KEY = "mm_last_order";

// Saved the moment an order is confirmed (app/checkout/success, and the
// test-mode checkout). No accounts or login — just "the last thing this
// browser ordered", for a one-tap reorder.
export function saveLastOrder(items: SavedOrder["items"]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, at: Date.now() }));
  } catch {
    // ignore — reorder is a convenience, not something to ever block on
  }
}

// Remembered just before the customer goes to the payment page, so the
// success page saves exactly what was paid for (even if the cart changed).
const PENDING_KEY = "mm_pending_order";
export function rememberPendingOrder(items: SavedOrder["items"]) {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(items));
  } catch {
    // ignore
  }
}
export function takePendingOrder(): SavedOrder["items"] | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    const items = raw ? JSON.parse(raw) : null;
    return Array.isArray(items) && items.length ? items : null;
  } catch {
    return null;
  }
}

// Shows only what can actually be bought online right now, at today's price
// (checked with /api/products/reorder) — never an item that's sold out or
// off the website, like wine & beer while they're hidden.
export default function ReorderCard() {
  const { add, openDrawer } = useCart();
  const [saved, setSaved] = useState<SavedOrder | null>(null);
  const [available, setAvailable] = useState<Available[] | null>(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let order: SavedOrder | null = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) order = JSON.parse(raw);
    } catch {
      // ignore — just means no reorder card shows
    }
    if (!order || !Array.isArray(order.items) || order.items.length === 0) return;
    fetch("/api/products/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: order.items.map((i) => i.id) }),
    })
      .then((r) => r.json())
      .then((b: { items?: Available[] }) => {
        if (cancelled) return;
        setSaved(order);
        setAvailable(b.items ?? []);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!saved || !available || available.length === 0) return null;

  const lines = saved.items
    .map((i) => {
      const live = available.find((a) => a.id === i.id);
      return live ? { ...live, qty: Math.min(i.qty, live.stock) } : null;
    })
    .filter((x): x is Available & { qty: number } => x !== null && x.qty > 0);
  if (lines.length === 0) return null;
  const missing = saved.items.length - lines.length;
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);

  const handleReorder = () => {
    for (const l of lines) {
      for (let n = 0; n < l.qty; n++) {
        add({ id: l.id, name: l.name, price: l.price, ageRestricted: l.ageRestricted, image: l.image || undefined });
      }
    }
    setAdded(true);
    openDrawer();
  };

  return (
    <section className="bg-paper">
      <div className="mx-auto max-w-6xl px-5 pt-10">
        <div className="flex flex-col gap-4 rounded-2xl border-2 border-ink bg-gold-tint p-4 shadow-sticker sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-green">Your last order</p>
            <p className="font-poster mt-1 text-3xl uppercase leading-none text-ink">Order it again</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {lines.map((l) => (
                <li key={l.id} className="flex items-center gap-2 rounded-full border-2 border-ink bg-paper py-1 pl-1 pr-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white">
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={l.image} alt="" className="h-full w-full object-contain" />
                    ) : (
                      <span className="font-poster text-xs uppercase text-ink/50">{l.name.slice(0, 2)}</span>
                    )}
                  </span>
                  <span className="font-body text-sm font-semibold text-ink">
                    {l.qty > 1 ? `${l.qty}× ` : ""}
                    {l.name}
                  </span>
                </li>
              ))}
            </ul>
            {missing > 0 && (
              <p className="mt-2 font-body text-xs text-ink-soft">
                {missing === 1 ? "1 item from that order isn't" : `${missing} items from that order aren't`} available online right now.
              </p>
            )}
          </div>
          <button
            onClick={handleReorder}
            className="shrink-0 rounded-full border-2 border-ink bg-pink-deep px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0"
          >
            {added ? "Added to cart ✓" : `Add to cart · $${total.toFixed(2)}`}
          </button>
        </div>
      </div>
    </section>
  );
}
