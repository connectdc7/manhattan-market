"use client";

import { useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { decrementStock } from "@/lib/products";
import { createOrder } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveLastOrder } from "@/components/ReorderCard";

type Stage = "review" | "processing" | "done";

export default function CheckoutPage() {
  const { lines, subtotal, clear } = useCart();
  const [stage, setStage] = useState<Stage>("review");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [phone, setPhone] = useState("");

  const placeOrder = () => {
    setStage("processing");
    const orderedLines = lines.map((l) => ({ id: l.id, qty: l.qty }));
    const orderItems = lines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty }));
    const orderFulfillment = fulfillment;
    const orderSubtotal = subtotal;
    const orderPhone = phone.trim() || null;
    setTimeout(async () => {
      // Payment is mocked (Stripe goes here later), but the stock decrement
      // and order record are real when Supabase is configured — so the
      // menu and the employee dashboard reflect the order immediately, the
      // same way they would once Clover is wired in.
      await decrementStock(orderedLines);
      await createOrder({
        fulfillment: orderFulfillment,
        items: orderItems,
        subtotal: orderSubtotal,
        phone: orderPhone,
      });
      saveLastOrder(orderItems);
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
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-2xl text-white [animation:stamp-in_0.5s_cubic-bezier(0.2,1.4,0.4,1)_forwards]">
          ✓
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">Order placed</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">
          {isSupabaseConfigured
            ? "Stock for what you ordered just updated — check the menu and you'll see it. Once Clover is wired in, that same update will happen automatically whenever a customer orders online."
            : "In the live site, stock updates automatically the moment an order comes in, and — for delivery orders — a courier is requested through Uber Direct right away."}
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

      <div className="mt-8 rounded-lg border border-line bg-paper p-5">
        <div className="flex flex-col gap-2.5">
          {lines.map((line) => (
            <div key={line.id} className="receipt-line font-mono text-sm text-ink">
              <span className="whitespace-nowrap">
                {line.name} <span className="text-ink-soft">× {line.qty}</span>
              </span>
              <span className="receipt-fill" />
              <span className="whitespace-nowrap font-semibold">${(line.price * line.qty).toFixed(2)}</span>
            </div>
          ))}
        </div>
        <div className="receipt-perforation -mx-5 mt-4 w-[calc(100%+2.5rem)]" />
        <div className="receipt-line mt-4 font-body text-sm font-semibold text-ink">
          <span>Subtotal</span>
          <span className="receipt-fill" />
          <span className="price-tag font-mono">${subtotal.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="font-body text-sm font-semibold text-ink">Fulfillment</p>
        <div className="mt-2 flex gap-2">
          {(["pickup", "delivery"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold capitalize transition-all active:scale-95 ${
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

      <label className="mt-6 flex flex-col gap-1">
        <span className="font-body text-sm font-semibold text-ink">
          Phone <span className="font-normal text-ink-soft">(optional — get a text when it's ready)</span>
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-0123"
          className="rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green sm:max-w-xs"
        />
      </label>

      <button
        onClick={placeOrder}
        disabled={stage === "processing"}
        className="mt-8 w-full rounded-full bg-green py-3.5 text-center font-mono text-sm font-semibold text-white transition-all hover:bg-green-deep active:scale-[0.98] disabled:opacity-60"
      >
        {stage === "processing" ? "Processing…" : `Place Order — $${subtotal.toFixed(2)}`}
      </button>
      <p className="mt-2 text-center font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
        Preview build — Stripe Checkout will replace this step
        {isSupabaseConfigured ? " · stock will update live in Supabase" : ""}
      </p>
    </div>
  );
}
