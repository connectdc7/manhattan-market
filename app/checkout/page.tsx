"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { decrementStock } from "@/lib/products";
import { createOrder } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase";
import { rememberPendingOrder, saveLastOrder } from "@/components/ReorderCard";
import { getStoreSettings } from "@/lib/settings";

type Stage = "review" | "processing" | "done";

const fieldClass =
  "rounded-xl border-2 border-ink bg-paper px-3.5 py-2.5 font-body text-base text-ink outline-none focus:shadow-[3px_3px_0_var(--gold)] sm:text-sm";

export default function CheckoutPage() {
  const { lines, subtotal, clear, count } = useCart();
  const [stage, setStage] = useState<Stage>("review");
  const [chosenFulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Delivery address + Uber quote. `uberReady` is null until we know
  // whether Uber is set up; when it isn't, delivery works without a fee.
  const [addr, setAddr] = useState({ name: "", street: "", apt: "", city: "Washington", state: "DC", zip: "", notes: "" });
  const [uberReady, setUberReady] = useState<boolean | null>(null);
  const [quote, setQuote] = useState<{ fee: number; durationMin: number | null } | null>(null);
  // Owner-set flat service fee on delivery orders (dashboard → Settings).
  const [serviceFee, setServiceFee] = useState(0);
  // Wine/beer: delivery only when the owner has switched it on (Settings).
  const [alcoholDelivery, setAlcoholDelivery] = useState(false);
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const hasAlcohol = lines.some((l) => l.ageRestricted);
  const deliveryBlocked = hasAlcohol && !alcoholDelivery;

  useEffect(() => {
    getStoreSettings().then((s) => {
      setServiceFee(s.deliveryServiceFee);
      setAlcoholDelivery(s.alcoholDelivery);
    });
  }, []);

  // Wine/beer in the cart while alcohol delivery is off → pickup only.
  const fulfillment: "pickup" | "delivery" = deliveryBlocked ? "pickup" : chosenFulfillment;
  const [quoting, setQuoting] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const setField = (key: keyof typeof addr, value: string) => {
    setAddr((prev) => ({ ...prev, [key]: value }));
    // Any address change invalidates the fee shown.
    setQuote(null);
    setQuoteError(null);
  };

  const deliveryFee = fulfillment === "delivery" && quote ? quote.fee : 0;
  const appliedServiceFee = fulfillment === "delivery" ? serviceFee : 0;
  // Welcome offer (first order): checked by /api/checkout/promo, and again
  // by the server when payment starts. Drops off if the cart falls below the minimum.
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<{ code: string; discount: number; min: number } | null>(null);
  const [promoMsg, setPromoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const promoApplied = promo !== null && subtotal >= promo.min;
  const discount = promoApplied ? promo.discount : 0;
  // DC sales tax, worked out on the server from each item's Clover tax rates.
  const [taxCents, setTaxCents] = useState<number | null>(null);
  const cartKey = lines.map((l) => `${l.id}:${l.qty}`).join(",");
  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(() => {
      fetch("/api/checkout/tax", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: lines.map((l) => ({ id: l.id, qty: l.qty })), discountCents: Math.round(discount * 100) }),
      })
        .then((r) => r.json())
        .then((b) => !cancelled && setTaxCents(typeof b.taxCents === "number" ? b.taxCents : null))
        .catch(() => {});
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, discount]);
  const tax = (taxCents ?? 0) / 100;
  const total = subtotal - discount + tax + deliveryFee + appliedServiceFee;

  const applyPromo = async () => {
    if (!promoInput.trim()) return;
    setPromoBusy(true);
    setPromoMsg(null);
    try {
      const res = await fetch("/api/checkout/promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: promoInput.trim(), phone: phone.trim(), items: lines.map((l) => ({ id: l.id, qty: l.qty })) }),
      });
      const body = await res.json();
      if (res.ok && body.ok) {
        setPromo({ code: body.code, discount: Number(body.discount), min: Number(body.min) });
        setPromoMsg({ ok: true, text: `${body.code} applied — $${Number(body.discount).toFixed(2)} off your first order.` });
      } else {
        setPromo(null);
        setPromoMsg({ ok: false, text: body.error || "That code isn't valid." });
      }
    } catch {
      setPromoMsg({ ok: false, text: "Couldn't check the code — try again." });
    }
    setPromoBusy(false);
  };
  const needsQuote = fulfillment === "delivery" && uberReady !== false && !quote;

  const getQuote = async () => {
    setQuoting(true);
    setQuoteError(null);
    try {
      const res = await fetch("/api/delivery/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, phone: phone.trim() || null }),
      });
      const body = await res.json();
      if (typeof body.serviceFee === "number") setServiceFee(body.serviceFee);
      if (body.configured === false) {
        setUberReady(false);
      } else {
        setUberReady(true);
        if (res.ok) setQuote({ fee: Number(body.fee), durationMin: body.durationMin ?? null });
        else setQuoteError(body.error || "Couldn't get a delivery quote — try again.");
      }
    } catch {
      setQuoteError("Couldn't get a delivery quote — check your connection.");
    }
    setQuoting(false);
  };
  // Only used to decide what the small print under "Place Order" says —
  // the actual mock-vs-real decision happens server-side in placeOrder,
  // this is purely so the page doesn't claim to be a preview once it isn't.
  const [stripeConfigured, setStripeConfigured] = useState(false);
  const [payProvider, setPayProvider] = useState<"stripe" | "clover" | "none">("none");

  useEffect(() => {
    fetch("/api/checkout/status")
      .then((r) => r.json())
      .then((body) => {
        setStripeConfigured(Boolean(body.stripeConfigured));
        setPayProvider(body.provider === "clover" ? "clover" : body.provider === "stripe" ? "stripe" : "none");
      })
      .catch(() => {});
  }, []);

  // Runs the old instant mocked order — kept as the fallback for whenever
  // Stripe isn't configured yet (see placeOrder below), the same
  // graceful-degradation pattern the rest of this project uses for Clover,
  // Twilio, and the AI photo reader.
  const placeMockOrder = () => {
    const orderedLines = lines.map((l) => ({ id: l.id, qty: l.qty }));
    const orderItems = lines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty }));
    const orderFulfillment = fulfillment;
    const orderSubtotal = subtotal;
    const orderPhone = phone.trim() || null;
    const orderDelivery = orderFulfillment === "delivery" ? { ...addr } : null;
    const orderDeliveryFee = orderFulfillment === "delivery" ? deliveryFee : null;
    const orderServiceFee = orderFulfillment === "delivery" && appliedServiceFee > 0 ? appliedServiceFee : null;
    setTimeout(async () => {
      await decrementStock(orderedLines);
      await createOrder({
        fulfillment: orderFulfillment,
        items: orderItems,
        subtotal: orderSubtotal,
        phone: orderPhone,
        delivery_address: orderDelivery,
        delivery_fee: orderDeliveryFee,
        service_fee: orderServiceFee,
      });
      saveLastOrder(orderItems);
      setStage("done");
      clear();
    }, 1400);
  };

  const placeOrder = async () => {
    setError(null);
    if (hasAlcohol && !ageConfirmed) {
      setError("Please confirm you're 21 or older and will show a valid photo ID.");
      return;
    }
    if (fulfillment === "delivery") {
      if (!addr.name.trim() || !addr.street.trim() || !addr.zip.trim()) {
        setError("Enter your name, street address and ZIP for delivery.");
        return;
      }
      if (!phone.trim()) {
        setError("Enter a phone number so the courier can reach you.");
        return;
      }
      if (needsQuote) {
        setError("Tap \"Get delivery fee\" first so we can confirm Uber delivers to you.");
        return;
      }
    }
    setStage("processing");

    try {
      const res = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: lines.map((l) => ({ id: l.id, qty: l.qty })),
          fulfillment,
          phone: phone.trim() || null,
          delivery: fulfillment === "delivery" ? addr : null,
          ageConfirmed: hasAlcohol ? ageConfirmed : undefined,
          promoCode: promoApplied ? promo.code : undefined,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        if (body.promoInvalid) {
          setPromo(null);
          setPromoMsg({ ok: false, text: body.error });
        }
        setError(
          body.undeliverable
            ? `${body.error || "We can't deliver there."} Switch to pickup to continue.`
            : body.error || "Couldn't start checkout — try again."
        );
        if (body.undeliverable) setQuote(null);
        setStage("review");
        return;
      }
      if (body.mock) {
        // Stripe isn't configured yet — same instant preview flow as before.
        placeMockOrder();
        return;
      }
      // Full page navigation to Stripe's hosted Checkout page — the cart
      // stays in localStorage untouched until payment actually succeeds
      // (see app/checkout/success/page.tsx), so cancelling and coming back
      // doesn't lose it.
      rememberPendingOrder(lines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty })));
      window.location.href = body.url;
    } catch {
      setError("Couldn't start checkout — check your connection and try again.");
      setStage("review");
    }
  };

  if (lines.length === 0 && stage === "review") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <h1 className="font-poster text-4xl uppercase leading-none text-ink sm:text-5xl">Your cart is empty</h1>
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
        <h1 className="mt-5 font-poster text-4xl uppercase leading-none text-ink sm:text-5xl">Order placed</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">
          {isSupabaseConfigured
            ? "Stock for what you ordered just updated — check the menu and you'll see it. Once Clover is wired in, that same update will happen automatically whenever a customer orders online."
            : "In the live site, stock updates automatically the moment an order comes in, and — for delivery orders — a courier is requested through Uber Direct right away."}
        </p>
        <p className="mt-4 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">
          Preview build — Stripe isn&apos;t connected yet, so no payment was actually processed
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
      <p className="inline-block rounded-full border-2 border-ink bg-gold px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-widest text-gold-ink">
        Checkout · {count} item{count === 1 ? "" : "s"}
      </p>
      <h1 className="mt-2 font-poster text-4xl uppercase leading-none text-ink sm:text-5xl">Review your order</h1>

      <div className="mt-8 overflow-hidden rounded-2xl border-2 border-ink bg-paper p-5 shadow-[5px_5px_0_var(--ink)]">
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
        <div className="receipt-line mt-4 font-body text-sm text-ink">
          <span>Subtotal</span>
          <span className="receipt-fill" />
          <span className="font-mono">${subtotal.toFixed(2)}</span>
        </div>
        {promoApplied && (
          <div className="receipt-line mt-2 font-body text-sm text-green">
            <span>Welcome offer ({promo.code})</span>
            <span className="receipt-fill" />
            <span className="font-mono">−${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="receipt-line mt-2 font-body text-sm text-ink">
          <span>DC sales tax</span>
          <span className="receipt-fill" />
          <span className="font-mono">{taxCents === null ? "…" : `$${tax.toFixed(2)}`}</span>
        </div>
        {fulfillment === "delivery" && (
          <div className="receipt-line mt-2 font-body text-sm text-ink">
            <span>Delivery (Uber)</span>
            <span className="receipt-fill" />
            <span className="font-mono">
              {quote ? `$${quote.fee.toFixed(2)}` : uberReady === false ? "—" : "enter address"}
            </span>
          </div>
        )}
        {fulfillment === "delivery" && appliedServiceFee > 0 && (
          <div className="receipt-line mt-2 font-body text-sm text-ink">
            <span>Service fee</span>
            <span className="receipt-fill" />
            <span className="font-mono">${appliedServiceFee.toFixed(2)}</span>
          </div>
        )}
        <div className="receipt-line mt-2 font-body text-sm font-semibold text-ink">
          <span>Total</span>
          <span className="receipt-fill" />
          <span className="price-tag font-mono">${total.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-6">
        <p className="font-poster text-2xl uppercase text-ink">How do you want it?</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {(["pickup", "delivery"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFulfillment(f)}
              disabled={f === "delivery" && deliveryBlocked}
              aria-pressed={fulfillment === f}
              className={`rounded-2xl border-2 border-ink p-4 text-left transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
                fulfillment === f ? "bg-green text-white shadow-[4px_4px_0_var(--ink)]" : "bg-paper text-ink hover:bg-gold-tint"
              }`}
            >
              <span className="font-poster block text-2xl uppercase leading-none">{f === "pickup" ? "Pickup" : "Delivery"}</span>
              <span className={`mt-1 block font-body text-xs ${fulfillment === f ? "text-white/85" : "text-ink-soft"}`}>
                {f === "pickup" ? "Ready in ~15 min at 2647 Connecticut Ave" : "By Uber · fee shown below"}
              </span>
            </button>
          ))}
        </div>
        {deliveryBlocked && (
          <p className="mt-2 font-body text-xs text-ink-soft">
            Orders with wine or beer are pickup only for now. Remove those items if you&apos;d like delivery.
          </p>
        )}
        {fulfillment === "delivery" && (
          <div className="mt-4 rounded-2xl border-2 border-ink bg-panel p-4">
            <p className="font-body text-xs text-ink-soft">
              Delivered by an Uber courier. The fee is Uber&apos;s live price for your address.
            </p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-body text-xs font-semibold text-ink">Name</span>
                <input value={addr.name} onChange={(e) => setField("name", e.target.value)} autoComplete="name" className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-body text-xs font-semibold text-ink">Street address</span>
                <input value={addr.street} onChange={(e) => setField("street", e.target.value)} autoComplete="address-line1" className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-body text-xs font-semibold text-ink">Apt / unit (optional)</span>
                <input value={addr.apt} onChange={(e) => setField("apt", e.target.value)} autoComplete="address-line2" className={fieldClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-body text-xs font-semibold text-ink">City</span>
                <input value={addr.city} onChange={(e) => setField("city", e.target.value)} autoComplete="address-level2" className={fieldClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-body text-xs font-semibold text-ink">State</span>
                  <input value={addr.state} onChange={(e) => setField("state", e.target.value)} autoComplete="address-level1" className={fieldClass} />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="font-body text-xs font-semibold text-ink">ZIP</span>
                  <input value={addr.zip} onChange={(e) => setField("zip", e.target.value)} inputMode="numeric" autoComplete="postal-code" className={fieldClass} />
                </label>
              </div>
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="font-body text-xs font-semibold text-ink">Instructions for the courier (optional)</span>
                <input value={addr.notes} onChange={(e) => setField("notes", e.target.value)} placeholder="Buzz 4B, leave with front desk…" className={fieldClass} />
              </label>
            </div>
            {uberReady !== false && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={getQuote}
                  disabled={quoting}
                  className="rounded-full border border-green px-4 py-1.5 font-mono text-xs font-semibold text-green transition hover:bg-green hover:text-white disabled:opacity-60"
                >
                  {quoting ? "Checking…" : quote ? "Refresh fee" : "Get delivery fee"}
                </button>
                {quote && (
                  <span className="font-body text-sm text-ink">
                    ${quote.fee.toFixed(2)} delivery
                    {quote.durationMin ? ` · about ${quote.durationMin} min once it's ready` : ""}
                  </span>
                )}
              </div>
            )}
            {quoteError && (
              <p className="mt-2 font-body text-sm text-[#a8461a]" role="alert">
                {quoteError}{" "}
                <button type="button" onClick={() => setFulfillment("pickup")} className="underline">
                  Switch to pickup
                </button>
              </p>
            )}
          </div>
        )}
      </div>

      <label className="mt-6 flex flex-col gap-1">
        <span className="font-body text-sm font-semibold text-ink">
          Phone{" "}
          <span className="font-normal text-ink-soft">
            {fulfillment === "delivery" ? "(required — the courier may call you)" : "(optional — get a text when it's ready)"}
          </span>
        </span>
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="(555) 555-0123"
          className={`${fieldClass} sm:max-w-xs`}
        />
      </label>

      <div className="mt-6">
        <span className="font-body text-sm font-semibold text-ink">
          Promo code <span className="font-normal text-ink-soft">(optional)</span>
        </span>
        <div className="mt-1 flex gap-2 sm:max-w-xs">
          <input
            type="text"
            value={promoInput}
            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && applyPromo()}
            placeholder="WELCOME5"
            autoCapitalize="characters"
            className={`${fieldClass} min-w-0 flex-1 font-mono uppercase`}
          />
          <button
            type="button"
            onClick={applyPromo}
            disabled={promoBusy || !promoInput.trim()}
            className="rounded-xl border-2 border-ink bg-gold px-4 py-2 font-mono text-xs font-bold uppercase text-gold-ink hover:brightness-95 disabled:opacity-50"
          >
            {promoBusy ? "Checking…" : "Apply"}
          </button>
        </div>
        {promoMsg && (
          <p className={`mt-1.5 font-body text-xs ${promoMsg.ok ? "text-green" : "text-[#a8461a]"}`}>{promoMsg.text}</p>
        )}
        {promo && !promoApplied && (
          <p className="mt-1.5 font-body text-xs text-[#a8461a]">
            Add ${(promo.min - subtotal).toFixed(2)} more to use {promo.code} (orders of ${promo.min.toFixed(2)}+).
          </p>
        )}
        <p className="mt-1 font-body text-xs text-ink-soft">Welcome offers need your phone number — one per customer.</p>
      </div>

      {hasAlcohol && (
        <label className="mt-6 flex items-start gap-2.5 rounded-lg border border-line bg-paper p-4">
          <input
            type="checkbox"
            checked={ageConfirmed}
            onChange={(e) => setAgeConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span className="font-body text-sm text-ink">
            <span className="font-semibold">I&apos;m 21 or older.</span>{" "}
            <span className="text-ink-soft">
              Your order includes wine or beer. Bring a valid photo ID — we&apos;ll check it at{" "}
              {fulfillment === "delivery" ? "the door" : "pickup"} before handing over those items.
            </span>
          </span>
        </label>
      )}

      {error && (
        <p className="mt-4 font-body text-sm text-[#a8461a]" role="alert">
          {error}
        </p>
      )}

      <button
        onClick={placeOrder}
        disabled={stage === "processing"}
        className="shadow-sticker mt-8 w-full rounded-full border-2 border-ink bg-pink-deep py-4 text-center font-mono text-sm font-bold uppercase tracking-wide text-white transition-all hover:-translate-y-0.5 active:translate-y-0 active:shadow-none disabled:opacity-60"
      >
        {stage === "processing"
          ? stripeConfigured
            ? "Redirecting to secure checkout…"
            : "Processing…"
          : `Place Order — $${total.toFixed(2)}`}
      </button>
      <p className="mt-2 text-center font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
        {stripeConfigured
          ? `Payment is handled securely by ${payProvider === "clover" ? "Clover" : "Stripe"} — you'll be redirected to complete it`
          : "Preview build — Stripe isn't connected yet, so this places an instant test order"}
      </p>
    </div>
  );
}
