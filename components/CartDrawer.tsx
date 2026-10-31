"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart-context";
import { getStoreSettings, WelcomeOffer } from "@/lib/settings";

// The slide-out cart, in the same bold green/gold style as the rest of the site.
const QUICK_AISLES = ["Snacks & Candy", "Drinks", "Hot Food & Coffee", "Pantry & Grocery"];

export default function CartDrawer() {
  const { lines, drawerOpen, closeDrawer, setQty, remove, subtotal, count } = useCart();
  const router = useRouter();
  const [welcome, setWelcome] = useState<WelcomeOffer | null>(null);

  // Welcome offer (if the owner has it on) — used for the "add $X more" nudge.
  useEffect(() => {
    let cancelled = false;
    getStoreSettings()
      .then((s) => {
        if (!cancelled && s.welcomeOffer.enabled) setWelcome(s.welcomeOffer);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Esc closes the cart.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeDrawer();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen, closeDrawer]);

  const hasAlcohol = lines.some((l) => l.ageRestricted);
  const toWelcome = welcome ? Math.max(0, welcome.min - subtotal) : 0;

  return (
    <>
      <div
        onClick={closeDrawer}
        aria-hidden
        className={`fixed inset-0 z-50 bg-ink/50 transition-opacity ${drawerOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        aria-hidden={!drawerOpen}
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l-2 border-ink bg-paper shadow-2xl transition-transform duration-300 ${
          drawerOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b-2 border-ink bg-bodega-tiles px-5 py-4 text-white">
          <h2 className="font-poster flex items-center gap-3 text-3xl uppercase leading-none">
            Your order
            <span className="rounded-full border-2 border-ink bg-gold px-2.5 py-0.5 font-mono text-sm font-bold text-gold-ink">{count}</span>
          </h2>
          <button
            onClick={closeDrawer}
            aria-label="Close cart"
            className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white/60 font-mono text-lg leading-none text-white transition hover:border-white hover:bg-white/10"
          >
            ×
          </button>
        </div>

        {/* Lines */}
        <div className="flex-1 overflow-y-auto px-5 py-5">
          {lines.length === 0 ? (
            <div className="flex flex-col items-start gap-4 pt-4">
              <p className="font-poster text-4xl uppercase leading-none text-ink">Your cart is empty</p>
              <p className="font-body text-sm text-ink-soft">Snacks, drinks, groceries — ready in about 15 minutes or delivered.</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_AISLES.map((a) => (
                  <Link
                    key={a}
                    href={`/order?aisle=${encodeURIComponent(a)}`}
                    onClick={closeDrawer}
                    className="rounded-full border-2 border-ink bg-paper px-3.5 py-1.5 font-body text-sm font-semibold text-ink transition hover:bg-gold"
                  >
                    {a}
                  </Link>
                ))}
              </div>
              <Link
                href="/order"
                onClick={closeDrawer}
                className="shadow-sticker mt-2 rounded-full border-2 border-ink bg-pink-deep px-6 py-3 font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
              >
                Start shopping
              </Link>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {lines.map((line) => (
                <li key={line.id} className="flex gap-3 rounded-2xl border-2 border-ink bg-paper p-3">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border-2 border-ink bg-white">
                    {line.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={line.image} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="font-poster text-xl uppercase text-ink/40">{line.name.slice(0, 2)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 font-body text-sm font-semibold leading-snug text-ink">
                        {line.name}
                        {line.ageRestricted && (
                          <span className="ml-1.5 rounded bg-ink px-1 py-0.5 align-middle font-mono text-[0.55rem] font-bold text-white">21+</span>
                        )}
                      </p>
                      <span className="whitespace-nowrap font-mono text-sm font-bold text-ink">${(line.price * line.qty).toFixed(2)}</span>
                    </div>
                    <p className="font-mono text-[0.65rem] text-ink-soft">${line.price.toFixed(2)} each</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center rounded-full border-2 border-ink">
                        <button
                          onClick={() => setQty(line.id, line.qty - 1)}
                          aria-label={`One fewer ${line.name}`}
                          className="h-8 w-8 rounded-l-full font-mono text-base font-bold text-ink transition hover:bg-gold-tint active:scale-90"
                        >
                          −
                        </button>
                        <span key={line.qty} className="w-7 text-center font-mono text-sm font-bold [animation:bump_0.3s_ease]">
                          {line.qty}
                        </span>
                        <button
                          onClick={() => setQty(line.id, line.qty + 1)}
                          aria-label={`One more ${line.name}`}
                          className="h-8 w-8 rounded-r-full font-mono text-base font-bold text-ink transition hover:bg-gold-tint active:scale-90"
                        >
                          +
                        </button>
                      </div>
                      <button
                        onClick={() => remove(line.id)}
                        className="font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-ink-soft hover:text-[#a8461a]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {lines.length > 0 && (
          <div className="border-t-2 border-ink bg-panel px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4">
            {welcome && (
              <p
                className={`mb-3 rounded-xl border-2 border-ink px-3 py-2 font-body text-xs font-semibold ${
                  toWelcome > 0 ? "bg-pink-tint text-ink" : "bg-gold text-gold-ink"
                }`}
              >
                {toWelcome > 0
                  ? `New customer? Add $${toWelcome.toFixed(2)} more and use ${welcome.code} for $${welcome.amount.toFixed(0)} off.`
                  : `New customer? Use ${welcome.code} at checkout for $${welcome.amount.toFixed(0)} off.`}
              </p>
            )}
            {hasAlcohol && (
              <p className="mb-3 font-body text-xs text-ink-soft">Includes wine or beer — 21+, bring a valid photo ID.</p>
            )}
            <div className="flex items-baseline justify-between">
              <span className="font-body text-sm text-ink-soft">Subtotal</span>
              <span className="font-mono text-2xl font-bold text-ink">${subtotal.toFixed(2)}</span>
            </div>
            <p className="font-body text-xs text-ink-soft">Sales tax and any delivery fee are added at checkout.</p>
            <button
              onClick={() => {
                closeDrawer();
                router.push("/checkout");
              }}
              className="shadow-sticker mt-4 w-[calc(100%-5px)] rounded-full border-2 border-ink bg-pink-deep py-3.5 text-center font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Checkout · ${subtotal.toFixed(2)}
            </button>
            <button
              onClick={closeDrawer}
              className="mt-2 w-full py-2 text-center font-mono text-xs font-semibold uppercase tracking-wide text-green hover:underline"
            >
              Keep shopping
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
