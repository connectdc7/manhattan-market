"use client";

import { useState } from "react";
import type { Order } from "@/lib/orders";
import { staffFetch } from "@/lib/staff-auth";

// The owner-only Refund control on an order card (components/dashboard/
// OrdersPanel.tsx). Whole order or chosen items, with a confirm step —
// refunds send real money back. The work happens in app/api/orders/refund.

const money = (n: number) => `$${n.toFixed(2)}`;

export default function RefundBox({ order, onDone }: { order: Order; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"full" | "items">("full");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [includeFees, setIncludeFees] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; lines: string[] } | null>(null);

  const already = new Map<string, number>();
  for (const r of order.refunded_items ?? []) already.set(r.id, (already.get(r.id) ?? 0) + r.qty);
  const remainingItems = order.items
    .map((it) => ({ ...it, left: it.qty - (already.get(it.id) ?? 0) }))
    .filter((it) => it.left > 0);

  const fees = (order.delivery_fee ?? 0) + (order.service_fee ?? 0);
  const paidTotal = order.subtotal + fees;
  const remaining = Math.max(0, paidTotal - (order.refunded_amount ?? 0));
  const partialAmount =
    remainingItems.reduce((s, it) => s + Number(it.price) * (qty[it.id] ?? 0), 0) + (includeFees ? fees : 0);
  const amount = mode === "full" ? remaining : partialAmount;

  // Fully refunded: keep showing the result message, but no more refunding.
  if (order.refund_status === "full" && !result) return null;

  const reset = () => {
    setOpen(false);
    setConfirming(false);
    setMode("full");
    setQty({});
    setIncludeFees(false);
  };

  const submit = async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setBusy(true);
    try {
      const res = await staffFetch("/api/orders/refund", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: order.id,
          ...(mode === "items"
            ? { items: Object.entries(qty).filter(([, q]) => q > 0).map(([id, q]) => ({ id, qty: q })), includeFees }
            : {}),
        }),
      });
      const body = await res.json();
      setResult(body.ok ? { ok: true, lines: body.notes ?? [] } : { ok: false, lines: [body.error || "Refund failed."] });
      if (body.ok) {
        reset();
        onDone();
      } else {
        setConfirming(false);
      }
    } catch {
      setResult({ ok: false, lines: ["Couldn't reach the server — check your connection. Nothing was refunded unless Stripe or Clover shows it."] });
      setConfirming(false);
    }
    setBusy(false);
  };

  return (
    <div className="w-full">
      {!open && order.refund_status !== "full" && (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setResult(null);
          }}
          className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a]"
        >
          Refund…
        </button>
      )}

      {result && (
        <div className={`mt-2 rounded border px-3 py-2 font-body text-xs ${result.ok ? "border-green/40 bg-green-tint text-green-deep" : "border-[#a8461a]/40 text-[#a8461a]"}`}>
          {result.lines.map((l, i) => (
            <p key={i}>{l}</p>
          ))}
        </div>
      )}

      {open && (
        <div className="mt-2 rounded-lg border border-[#a8461a]/40 bg-paper p-3">
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-[#a8461a]">Refund to the customer&apos;s card</p>

          <div className="mt-2 flex flex-col gap-1.5 font-body text-sm text-ink">
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "full"} onChange={() => { setMode("full"); setConfirming(false); }} />
              {order.refund_status === "partial" ? "Everything not yet refunded" : "Whole order"} — {money(remaining)}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={mode === "items"} onChange={() => { setMode("items"); setConfirming(false); }} />
              Only some items
            </label>
          </div>

          {mode === "items" && (
            <div className="mt-2 flex flex-col gap-1.5 rounded border border-line bg-panel p-2">
              {remainingItems.map((it) => {
                const q = qty[it.id] ?? 0;
                const set = (n: number) => {
                  setQty((prev) => ({ ...prev, [it.id]: Math.max(0, Math.min(it.left, n)) }));
                  setConfirming(false);
                };
                return (
                  <div key={it.id} className="flex items-center gap-2 font-body text-sm">
                    <span className="min-w-0 flex-1 truncate">{it.name}</span>
                    <span className="font-mono text-xs text-ink-soft">{money(Number(it.price))} ea</span>
                    <button type="button" onClick={() => set(q - 1)} className="h-6 w-6 rounded border border-line bg-paper" aria-label={`Fewer ${it.name}`}>−</button>
                    <span className="w-10 text-center font-mono text-xs">{q}/{it.left}</span>
                    <button type="button" onClick={() => set(q + 1)} className="h-6 w-6 rounded border border-line bg-paper" aria-label={`More ${it.name}`}>+</button>
                  </div>
                );
              })}
              {fees > 0 && (
                <label className="mt-1 flex items-center gap-2 font-body text-xs text-ink-soft">
                  <input type="checkbox" checked={includeFees} onChange={(e) => { setIncludeFees(e.target.checked); setConfirming(false); }} />
                  Also refund delivery + service fee ({money(fees)})
                </label>
              )}
            </div>
          )}

          <p className="mt-2 font-body text-xs text-ink-soft">
            {mode === "full"
              ? "Also removes the order from Clover, puts the items back in stock and cancels the Uber courier if it hasn't picked up yet."
              : "Puts those items back in stock and adds a refund note to the order in Clover."}{" "}
            The customer gets the money back in 5–10 days.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={submit}
              disabled={busy || amount <= 0}
              className={`rounded-full px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition disabled:opacity-50 ${
                confirming ? "bg-[#a8461a] hover:bg-[#8a3914]" : "bg-ink hover:bg-ink/80"
              }`}
            >
              {busy ? "Refunding…" : confirming ? `Yes, refund ${money(amount)}` : `Refund ${money(amount)}`}
            </button>
            <button type="button" onClick={reset} disabled={busy} className="font-mono text-xs text-ink-soft hover:text-ink">
              Cancel
            </button>
            {confirming && !busy && <span className="font-body text-xs text-[#a8461a]">This can&apos;t be undone.</span>}
          </div>
        </div>
      )}
    </div>
  );
}
