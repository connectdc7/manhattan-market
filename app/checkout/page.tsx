"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { products } from "@/lib/products";

type Stage = "review" | "processing" | "done";

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
  const [stage, setStage] = useState<Stage>("review");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");

  const placeOrder = () => {
    setStage("processing");
    setTimeout(() => {
      setStage("done");
      clear();
    }, 1400);
  };

  if (lines.length === 0 && stage === "review") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 className="font-display text-2xl font-bold text-ink">Your cart is empty</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">Add something from the menu first.</p>
        <Link
          href="/order"
          className="mt-6 inline-block rounded-full bg-green px-6 py-3 font-mono text-sm font-semibold text-white hover:bg-green-deep"
        >
          Order Online
        </Link>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-2xl text-white">
          ✓
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">Order placed</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">
          In the live site, Manhattan Market gets notified instantly, stock updates on
          the Clover terminal automatically, and — for delivery orders — a courier is
          requested through Uber Direct right away.
        </p>
        <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">
          Preview build — no payment was actually processed
        </p>
        <Link
          href="/order"
          className="mt-6 inline-block rounded-full border border-line px-6 py-3 font-mono text-sm font-semibold text-ink hover:border-green hover:text-green"
        >
          Back to Menu
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-12">
      <p className="eyebrow text-green">Checkout</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink">Review your order</h1>

      <div className="mt-8 divide-y divide-line rounded-lg border border-line">
        {lines.map((line) => {
          const product = products.find((p) => p.id === line.id);
          if (!product) return null;
          return (
            <div key={line.id} className="flex items-center justify-between px-5 py-3">
              <span className="font-body text-sm text-ink">
                {product.name} <span className="text-ink-soft">× {line.qty}</span>
              </span>
              <span className="font-mono text-sm font-semibold text-ink">
                ${(product.price * line.qty).toFixed(2)}
              </span>
            </div>
          );
        })}
        <div className="flex items-center justify-between px-5 py-3">
          <span className="font-body text-sm font-semibold text-ink">Subtotal</span>
          <span className="font-mono text-sm font-semibold text-ink">${subtotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="font-body text-sm font-semibold text-ink">Fulfillment</p>
        <div className="mt-2 flex gap-2">
          {(["pickup", "delivery"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold capitalize transition ${
                fulfillment === f
                  ? "border-green bg-green text-white"
                  : "border-line text-ink-soft hover:border-green hover:text-green"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        {fulfillment === "delivery" && (
          <p className="mt-2 font-body text-xs text-ink-soft">
            Dispatched through Uber Direct once the site is fully wired up — delivery fee
            calculated by distance at checkout.
          </p>
        )}
      </div>

      <button
        onClick={placeOrder}
        disabled={stage === "processing"}
        className="mt-8 w-full rounded-full bg-green py-3.5 text-center font-mono text-sm font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
      >
        {stage === "processing" ? "Processing…" : `Place Order — $${subtotal.toFixed(2)}`}
      </button>
      <p className="mt-2 text-center font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
        Preview build — Stripe Checkout will replace this step
      </p>
    </div>
  );
}
