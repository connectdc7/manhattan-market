"use client";

import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";

export default function CartDrawer() {
  const { lines, drawerOpen, closeDrawer, setQty, remove, subtotal, count } = useCart();
  const router = useRouter();

  return (
    <>
      <div
        onClick={closeDrawer}
        className={`fixed inset-0 z-50 bg-ink/40 transition-opacity ${
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-paper shadow-xl transition-transform ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="font-display text-lg font-bold text-ink">Your order ({count})</h2>
          <button onClick={closeDrawer} className="font-mono text-xs text-ink-soft hover:text-ink">
            Close
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {lines.length === 0 ? (
            <p className="font-body text-sm text-ink-soft">Nothing in your cart yet.</p>
          ) : (
            <div className="flex flex-col gap-4">
              {lines.map((line) => (
                <div key={line.id} className="flex items-start justify-between gap-3 transition-opacity duration-200">
                  <div className="min-w-0 flex-1">
                    <div className="receipt-line">
                      <p className="whitespace-nowrap font-mono text-sm text-ink">{line.name}</p>
                      <span className="receipt-fill" />
                      <span className="whitespace-nowrap font-mono text-sm font-semibold text-ink">
                        ${(line.price * line.qty).toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[0.65rem] text-ink-soft">${line.price.toFixed(2)} each</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        onClick={() => setQty(line.id, line.qty - 1)}
                        className="h-6 w-6 rounded border border-line font-mono text-xs text-ink transition hover:border-green active:scale-90"
                      >
                        −
                      </button>
                      <span key={line.qty} className="w-4 text-center font-mono text-xs [animation:bump_0.3s_ease]">
                        {line.qty}
                      </span>
                      <button
                        onClick={() => setQty(line.id, line.qty + 1)}
                        className="h-6 w-6 rounded border border-line font-mono text-xs text-ink transition hover:border-green active:scale-90"
                      >
                        +
                      </button>
                      <button
                        onClick={() => remove(line.id)}
                        className="ml-2 font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {lines.length > 0 ? <div className="receipt-perforation" /> : <div className="border-t border-line" />}

        <div className="px-5 py-4">
          <div className="receipt-line mb-3 font-body text-sm text-ink">
            <span>Subtotal</span>
            <span className="receipt-fill" />
            <span className="price-tag font-mono font-semibold">${subtotal.toFixed(2)}</span>
          </div>
          <button
            disabled={lines.length === 0}
            onClick={() => {
              closeDrawer();
              router.push("/checkout");
            }}
            className="w-full rounded-full bg-green py-3 text-center font-mono text-sm font-semibold text-white transition-all hover:bg-green-deep active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-line disabled:text-ink-soft"
          >
            Checkout
          </button>
          <p className="mt-2 text-center font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
            Preview build — payment not yet connected
          </p>
        </div>
      </aside>
    </>
  );
}
