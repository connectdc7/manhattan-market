"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Order } from "@/lib/orders";
import { stageOf } from "./OrdersPanel";

// Keeps new online orders front and centre on every dashboard page:
// a chime when one comes in (repeated while it sits unstarted), a big
// banner, and the live order counts in the top bar.

const SOUND_KEY = "mm-order-sound";

export function useOrderChime() {
  const [soundOn, setSoundOn] = useState(() => {
    try {
      return typeof window === "undefined" || localStorage.getItem(SOUND_KEY) !== "off";
    } catch {
      return true;
    }
  });
  const ctxRef = useRef<AudioContext | null>(null);

  // Browsers only allow sound after the person has tapped the page once —
  // so get the audio ready on the first tap anywhere.
  useEffect(() => {
    const unlock = () => {
      try {
        if (!ctxRef.current) ctxRef.current = new AudioContext();
        if (ctxRef.current.state === "suspended") ctxRef.current.resume();
      } catch {
        // no Web Audio — banner still shows
      }
    };
    window.addEventListener("pointerdown", unlock);
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const play = useCallback(() => {
    const ctx = ctxRef.current;
    if (!ctx || ctx.state !== "running") return;
    // A bright two-note "ding-dong", played twice.
    const notes = [
      [880, 0],
      [660, 0.18],
      [880, 0.5],
      [660, 0.68],
    ];
    for (const [freq, at] of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const t = ctx.currentTime + at;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.45);
    }
  }, []);

  const toggle = () =>
    setSoundOn((v) => {
      const next = !v;
      try {
        localStorage.setItem(SOUND_KEY, next ? "on" : "off");
      } catch {
        // ignore
      }
      if (next) setTimeout(play, 50);
      return next;
    });

  return { soundOn, toggle, play };
}

export function SoundButton({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={on ? "Order sound is on — tap to mute" : "Order sound is off — tap to turn on"}
      aria-label={on ? "Mute new-order sound" : "Turn on new-order sound"}
      aria-pressed={on}
      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 transition ${
        on ? "border-white/70 text-white hover:bg-white/10" : "border-gold bg-gold text-gold-ink"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <path d="M4 9v6h4l5 4V5L8 9z" />
        {on ? <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11" /> : <path d="m17 9 5 6M22 9l-5 6" />}
      </svg>
    </button>
  );
}

// The live counts in the top bar — tap to jump to the board.
export function OrderCounts({ orders, onOpen, className = "" }: { orders: Order[]; onOpen: (column: "new" | "preparing" | "ready") => void; className?: string }) {
  const n = { new: 0, preparing: 0, ready: 0, out: 0 };
  for (const o of orders) {
    const s = stageOf(o);
    if (s !== "done") n[s] += 1;
  }
  const chips: [string, number, string, "new" | "preparing" | "ready"][] = [
    ["New", n.new, n.new ? "bg-pink-deep text-white animate-pulse" : "bg-white/10 text-white/70", "new"],
    ["Prep", n.preparing, n.preparing ? "bg-gold text-gold-ink" : "bg-white/10 text-white/70", "preparing"],
    ["Ready", n.ready, n.ready ? "bg-white text-green-deep" : "bg-white/10 text-white/70", "ready"],
    ["On the way", n.out, n.out ? "bg-ink text-white" : "bg-white/10 text-white/70", "ready"],
  ];
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {chips.map(([label, count, cls, col]) => (
        <button
          key={label}
          type="button"
          onClick={() => onOpen(col)}
          aria-label={`${count} ${label} — show on the board`}
          className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 border-ink px-2.5 py-1 font-mono text-[0.62rem] font-bold uppercase tracking-wide transition hover:-translate-y-0.5 ${cls}`}
        >
          {label}
          <span className="text-[0.75rem]">{count}</span>
        </button>
      ))}
    </div>
  );
}

// The big "New online order" banner — shows on every page until someone
// starts it or taps ×.
export function NewOrderBanner({
  orders,
  onStart,
  onView,
  onDismiss,
}: {
  orders: Order[];
  onStart: (o: Order) => void;
  onView: () => void;
  onDismiss: () => void;
}) {
  if (orders.length === 0) return null;
  const first = orders[0];
  const count = first.items.reduce((n, i) => n + i.qty, 0);
  return (
    <div role="alert" className="fixed inset-x-3 top-[4.5rem] z-50 mx-auto max-w-xl sm:top-20">
      <div className="overflow-hidden rounded-2xl border-2 border-ink bg-pink-deep text-white shadow-sticker [animation:bump_0.4s_ease]">
        <div className="flex items-start gap-3 px-4 py-3">
          <span aria-hidden className="mt-0.5 flex h-10 w-10 shrink-0 animate-bounce items-center justify-center rounded-full border-2 border-ink bg-gold text-xl">
            🛍
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-mono text-[0.62rem] font-bold uppercase tracking-widest text-white/80">
              {orders.length > 1 ? `${orders.length} new online orders` : "New online order"}
            </p>
            <p className="font-poster text-2xl uppercase leading-tight">
              #{first.id.slice(0, 6).toUpperCase()} · {first.fulfillment === "delivery" ? "Delivery" : "Pickup"} · ${first.subtotal.toFixed(2)}
            </p>
            <p className="mt-0.5 truncate font-body text-sm text-white/90">
              {count} item{count === 1 ? "" : "s"}: {first.items.map((i) => `${i.qty}× ${i.name}`).join(", ")}
            </p>
          </div>
          <button type="button" onClick={onDismiss} aria-label="Hide" className="-mr-1 h-8 w-8 shrink-0 rounded-full font-mono text-lg leading-none text-white/80 hover:bg-white/10">
            ×
          </button>
        </div>
        <div className="flex gap-2 border-t-2 border-ink bg-paper px-4 py-3">
          <button
            type="button"
            onClick={() => onStart(first)}
            className="flex-1 rounded-full border-2 border-ink bg-gold py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-gold-ink hover:-translate-y-0.5"
          >
            Start preparing
          </button>
          <button
            type="button"
            onClick={onView}
            className="flex-1 rounded-full border-2 border-ink bg-paper py-2.5 font-mono text-xs font-bold uppercase tracking-wide text-ink hover:bg-panel"
          >
            {orders.length > 1 ? "See all" : "Open order"}
          </button>
        </div>
      </div>
    </div>
  );
}
