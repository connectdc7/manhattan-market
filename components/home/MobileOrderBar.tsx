"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";

// Phones only: a bar pinned to the bottom of the homepage so ordering is
// always one tap away, with the cart (and its total) right next to it.
export default function MobileOrderBar() {
  const { count, subtotal, openDrawer } = useCart();
  return (
    <>
      <div className="h-20 sm:hidden" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-paper/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:hidden">
        <div className="flex gap-3">
          <Link
            href="/order"
            className="flex flex-1 items-center justify-center rounded-full bg-green py-3 font-mono text-sm font-bold uppercase tracking-wide text-white active:scale-[0.98]"
          >
            Order now
          </Link>
          {count > 0 && (
            <button
              type="button"
              onClick={openDrawer}
              className="flex items-center gap-2 rounded-full bg-gold px-4 py-3 font-mono text-sm font-bold text-gold-ink active:scale-[0.98]"
            >
              Cart · {count} · ${subtotal.toFixed(2)}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
