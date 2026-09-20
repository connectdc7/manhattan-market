"use client";

// Where Stripe's hosted Checkout redirects back to after payment. The order
// itself was already created by the webhook (app/api/stripe/webhook) by the
// time a shopper lands here — this page's only job is to confirm that with
// Stripe directly (rather than just trusting the URL, which anyone could
// hit) before showing "Order placed," and to clear the local cart once it's
// confirmed.
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { isSupabaseConfigured } from "@/lib/supabase";
import { saveLastOrder } from "@/components/ReorderCard";

type Status = "checking" | "paid" | "unpaid" | "error";

function CheckoutSuccessInner() {
  const searchParams = useSearchParams();
  const { lines, clear } = useCart();
  const [status, setStatus] = useState<Status>("checking");
  const clearedCart = useRef(false);

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    if (!sessionId) {
      setStatus("error");
      return;
    }
    fetch(`/api/checkout/session?session_id=${encodeURIComponent(sessionId)}`)
      .then((r) => r.json())
      .then((body) => setStatus(body.status === "paid" ? "paid" : "unpaid"))
      .catch(() => setStatus("error"));
  }, [searchParams]);

  // Only clear the cart once payment is actually confirmed — cancelling
  // out of Stripe and coming back to /checkout should still have everything
  // in it. Guarded with a ref (not just the status check) so this can't
  // double-fire and, e.g., double-save the "last order" reorder card.
  useEffect(() => {
    if (status !== "paid" || clearedCart.current) return;
    clearedCart.current = true;
    if (lines.length > 0) {
      saveLastOrder(lines.map((l) => ({ id: l.id, name: l.name, price: l.price, qty: l.qty })));
    }
    clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (status === "checking") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Confirming your payment…</p>
      </div>
    );
  }

  if (status === "paid") {
    return (
      <div className="mx-auto max-w-lg px-5 py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green text-2xl text-white [animation:stamp-in_0.5s_cubic-bezier(0.2,1.4,0.4,1)_forwards]">
          ✓
        </div>
        <h1 className="mt-5 font-display text-2xl font-bold text-ink">Order placed</h1>
        <p className="mt-2 font-body text-sm text-ink-soft">
          Payment received — thanks!{" "}
          {isSupabaseConfigured
            ? "Stock for what you ordered just updated, and it's on the counter's order queue now."
            : "In the live site, stock updates automatically and the order lands on the counter's queue."}
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
    <div className="mx-auto max-w-lg px-5 py-20 text-center">
      <h1 className="font-display text-2xl font-bold text-ink">We couldn&apos;t confirm that payment</h1>
      <p className="mt-2 font-body text-sm text-ink-soft">
        If you just finished checking out, this can take a few seconds — try refreshing. Otherwise, your card
        wasn&apos;t charged and nothing was ordered.
      </p>
      <Link
        href="/checkout"
        className="mt-6 inline-block rounded-full bg-green px-6 py-3 font-mono text-sm font-semibold text-white hover:bg-green-deep"
      >
        Back to Checkout
      </Link>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-5 py-20 text-center">
          <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Confirming your payment…</p>
        </div>
      }
    >
      <CheckoutSuccessInner />
    </Suspense>
  );
}
