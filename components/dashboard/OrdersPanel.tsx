"use client";

import { useEffect, useMemo, useState } from "react";
import { Order, OrderStatus } from "@/lib/orders";
import { staffFetch } from "@/lib/staff-auth";
import RefundBox from "./RefundBox";

// Dashboard → Live orders. Every online order from the moment it's paid to
// the moment it's in the customer's hands: a board of New → Preparing →
// Ready / out for delivery, with timers, a packing checklist, and the Uber
// courier's progress on delivery orders.

// ── Stages ─────────────────────────────────────────────────────────────

type Stage = "new" | "preparing" | "ready" | "out" | "done";

const COURIER_ACTIVE = new Set(["pending", "pickup", "pickup_complete", "dropoff"]);
const ON_THE_ROAD = new Set(["pickup_complete", "dropoff"]);

export function stageOf(o: Order): Stage {
  if (o.status === "completed") return "done";
  if (o.status === "ready" && o.fulfillment === "delivery" && ON_THE_ROAD.has(o.uber_status ?? "")) return "out";
  return o.status;
}

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { new: "preparing", preparing: "ready", ready: "completed" };
const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = { preparing: "new", ready: "preparing", completed: "ready" };
const STATUS_LABEL: Record<OrderStatus, string> = { new: "New", preparing: "Preparing", ready: "Ready", completed: "Completed" };

const UBER_STEPS: { key: string; label: string }[] = [
  { key: "pending", label: "Finding a courier" },
  { key: "pickup", label: "Courier heading to store" },
  { key: "pickup_complete", label: "Picked up" },
  { key: "dropoff", label: "On the way to customer" },
  { key: "delivered", label: "Delivered" },
];
const UBER_LABEL: Record<string, string> = {
  ...Object.fromEntries(UBER_STEPS.map((s) => [s.key, s.label])),
  canceled: "Courier canceled",
  returned: "Returned to store",
};

// ── Time helpers ───────────────────────────────────────────────────────

function useNow(everyMs = 20_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

const minsSince = (iso: string | null | undefined, now: number) =>
  iso ? Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)) : null;

function dur(m: number | null) {
  if (m === null) return "";
  if (m < 1) return "just now";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} hr ${m % 60 ? `${m % 60} min` : ""}`.trim();
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

// ── Packing checklist (remembered per device) ──────────────────────────

const PACK_KEY = "mm-packed";
function loadPacked(): Record<string, number[]> {
  try {
    return JSON.parse(localStorage.getItem(PACK_KEY) || "{}");
  } catch {
    return {};
  }
}
function savePacked(v: Record<string, number[]>) {
  try {
    localStorage.setItem(PACK_KEY, JSON.stringify(v));
  } catch {
    // private mode etc. — the ticks just won't survive a refresh
  }
}

// ── Pieces ─────────────────────────────────────────────────────────────

function Progress({ o }: { o: Order }) {
  const delivery = o.fulfillment === "delivery";
  const steps = delivery ? ["Paid", "Preparing", "Ready", "Courier", "Delivered"] : ["Paid", "Preparing", "Ready", "Picked up"];
  const stage = stageOf(o);
  const at =
    stage === "new"
      ? 0
      : stage === "preparing"
        ? 1
        : stage === "ready"
          ? delivery && COURIER_ACTIVE.has(o.uber_status ?? "")
            ? 3
            : 2
          : stage === "out"
            ? 3
            : steps.length; // done → everything ticked
  return (
    <ol className="flex items-center" aria-label="Order progress">
      {steps.map((label, i) => {
        const done = i < at || (i === 0 && at >= 0);
        const current = i === at;
        return (
          <li key={label} className="flex flex-1 items-center last:flex-none">
            <span className="flex flex-col items-center gap-1">
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full border-2 border-ink font-mono text-[0.55rem] font-bold ${
                  current ? "bg-gold text-gold-ink" : done ? "bg-green text-white" : "bg-paper text-ink-soft"
                }`}
              >
                {done && !current ? "✓" : i + 1}
              </span>
              <span className={`whitespace-nowrap font-mono text-[0.55rem] font-bold uppercase tracking-wide ${current ? "text-ink" : "text-ink-soft"}`}>
                {label}
              </span>
            </span>
            {i < steps.length - 1 && <span className={`mx-1 mb-4 h-0.5 flex-1 ${i < at ? "bg-green" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

function UberBox({ o, busy, result, onRequest, onCancel }: { o: Order; busy: boolean; result?: string; onRequest: () => void; onCancel: () => void }) {
  const st = o.uber_status ?? "";
  const active = Boolean(o.uber_delivery_id) && COURIER_ACTIVE.has(st);
  const idx = UBER_STEPS.findIndex((s) => s.key === st);
  const canRequest =
    (o.status === "ready" || o.status === "preparing") && (!o.uber_delivery_id || st === "canceled" || st === "returned");

  return (
    <div className="rounded-xl border-2 border-ink bg-paper">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <span className="font-mono text-[0.62rem] font-bold uppercase tracking-widest text-ink">Uber courier</span>
        {o.uber_tracking_url && (
          <a href={o.uber_tracking_url} target="_blank" rel="noreferrer" className="font-mono text-[0.62rem] font-bold uppercase tracking-wide text-green hover:underline">
            Live map ↗
          </a>
        )}
      </div>
      <div className="px-3 py-2.5">
        {o.uber_delivery_id && idx >= 0 ? (
          <ol className="flex flex-col gap-1">
            {UBER_STEPS.map((s, i) => (
              <li key={s.key} className={`flex items-center gap-2 font-body text-xs ${i === idx ? "font-bold text-ink" : i < idx ? "text-ink-soft" : "text-ink-soft/50"}`}>
                <span
                  className={`h-2.5 w-2.5 shrink-0 rounded-full border-2 ${
                    i === idx ? "animate-pulse border-ink bg-gold" : i < idx ? "border-green bg-green" : "border-line bg-paper"
                  }`}
                />
                {s.label}
                {s.key === "pickup" && o.uber_pickup_eta && i >= idx && <span className="font-mono text-[0.65rem] text-ink-soft">· at store ~{clock(o.uber_pickup_eta)}</span>}
                {s.key === "delivered" && o.uber_dropoff_eta && i >= idx && <span className="font-mono text-[0.65rem] text-ink-soft">· ~{clock(o.uber_dropoff_eta)}</span>}
              </li>
            ))}
          </ol>
        ) : o.uber_status ? (
          <p className="font-body text-xs font-semibold text-[#a8461a]">{UBER_LABEL[st] ?? st}</p>
        ) : (
          <p className="font-body text-xs text-ink-soft">
            {o.status === "new" || o.status === "preparing" ? "A courier is booked automatically when you tap Mark ready." : "No courier booked yet."}
          </p>
        )}
        {o.uber_courier?.name && (
          <p className="mt-2 font-body text-xs text-ink">
            <span className="font-semibold">{o.uber_courier.name}</span>
            {o.uber_courier.vehicle_type ? ` · ${o.uber_courier.vehicle_type}` : ""}
            {o.uber_courier.phone_number && (
              <>
                {" · "}
                <a href={`tel:${o.uber_courier.phone_number}`} className="font-semibold text-green underline">
                  Call courier
                </a>
              </>
            )}
          </p>
        )}
        {!result && o.uber_error && !active && <p className="mt-2 font-body text-xs text-[#a8461a]">{o.uber_error}</p>}
        {result && <p className="mt-2 font-body text-xs text-ink-soft">{result}</p>}
        {(canRequest || (active && (st === "pending" || st === "pickup"))) && (
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {canRequest && (
              <button
                onClick={onRequest}
                disabled={busy}
                className="rounded-full border-2 border-ink px-3.5 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-ink transition hover:bg-gold disabled:opacity-60"
              >
                {busy ? "Requesting…" : o.uber_delivery_id ? "Request a new courier" : "Request courier now"}
              </button>
            )}
            {active && (st === "pending" || st === "pickup") && (
              <button onClick={onCancel} disabled={busy} className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a]">
                Cancel courier
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const STRIP: Record<Stage, string> = {
  new: "bg-pink-deep text-white",
  preparing: "bg-gold text-gold-ink",
  ready: "bg-green text-white",
  out: "bg-ink text-white",
  done: "bg-panel text-ink-soft",
};

function stripLabel(o: Order): string {
  const s = stageOf(o);
  if (s === "new") return "New order";
  if (s === "preparing") return "Preparing";
  if (s === "out") return o.uber_status === "dropoff" ? "On the way to customer" : "Out for delivery";
  if (s === "done") return o.fulfillment === "delivery" ? "Delivered" : "Picked up";
  if (o.fulfillment === "pickup") return "Ready · waiting for customer";
  if (o.uber_status === "pickup") return "Ready · courier heading here";
  if (o.uber_status === "pending") return "Ready · finding a courier";
  return "Ready · needs a courier";
}

// How long the order has been at its current stage, and whether that's too long.
function timer(o: Order, now: number): { text: string; late: string | null } {
  const s = stageOf(o);
  if (s === "new") {
    const m = minsSince(o.created_at, now);
    return { text: `waiting ${dur(m)}`, late: m !== null && m >= 5 ? "Start this one!" : null };
  }
  if (s === "preparing") {
    const m = minsSince(o.preparing_at ?? o.created_at, now);
    return { text: `${dur(m)} in prep`, late: o.preparing_at && m !== null && m >= 15 ? "Taking a while" : null };
  }
  if (s === "ready") {
    const m = minsSince(o.ready_at, now);
    const late = o.fulfillment === "pickup" && m !== null && m >= 20 ? "Not picked up yet — call them?" : null;
    return { text: o.ready_at ? `ready ${dur(m)}` : `ordered ${clock(o.created_at)}`, late };
  }
  if (s === "out") return { text: o.uber_dropoff_eta ? `arrives ~${clock(o.uber_dropoff_eta)}` : "on the road", late: null };
  return { text: o.completed_at ? `done ${clock(o.completed_at)}` : clock(o.created_at), late: null };
}

// ── The board ──────────────────────────────────────────────────────────

const COLUMNS: { key: "new" | "preparing" | "ready"; title: string; hint: string; empty: string }[] = [
  { key: "new", title: "New", hint: "Paid — not started", empty: "No new orders" },
  { key: "preparing", title: "Preparing", hint: "Being packed", empty: "Nothing in prep" },
  { key: "ready", title: "Ready & out", hint: "Pickup shelf · couriers", empty: "Nothing waiting" },
];

export default function OrdersPanel({
  orders,
  onStatusChange,
  isOwner = false,
  onRefunded,
}: {
  orders: Order[];
  onStatusChange: (id: string, status: OrderStatus) => void | Promise<void>;
  // Refunds are owner-only (see components/dashboard/RefundBox.tsx).
  isOwner?: boolean;
  onRefunded?: () => void;
}) {
  const now = useNow();
  const [view, setView] = useState<"live" | "today" | "history">("live");
  const [cloverConnected, setCloverConnected] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<Record<string, string>>({});
  const [uberBusy, setUberBusy] = useState<string | null>(null);
  const [uberResult, setUberResult] = useState<Record<string, string>>({});
  const [packed, setPacked] = useState<Record<string, number[]>>(() => (typeof window === "undefined" ? {} : loadPacked()));
  const [historyLimit, setHistoryLimit] = useState(30);

  const togglePacked = (orderId: string, idx: number) =>
    setPacked((prev) => {
      const cur = new Set(prev[orderId] ?? []);
      if (cur.has(idx)) cur.delete(idx);
      else cur.add(idx);
      const next = { ...prev, [orderId]: [...cur] };
      // Forget ticks for orders that are long gone.
      const live = new Set(orders.filter((o) => o.status !== "completed").map((o) => o.id));
      for (const k of Object.keys(next)) if (!live.has(k) && k !== orderId) delete next[k];
      savePacked(next);
      return next;
    });

  // Books an Uber courier for a delivery order (also done automatically
  // when a delivery order is marked Ready). See app/api/delivery/dispatch.
  const requestCourier = async (orderId: string) => {
    setUberBusy(orderId);
    try {
      const res = await staffFetch("/api/delivery/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json();
      setUberResult((prev) => ({
        ...prev,
        [orderId]: body.ok
          ? body.alreadyDispatched
            ? "A courier is already booked."
            : `Uber courier requested${body.texted ? " — customer texted a tracking link" : ""}.`
          : body.error || "Couldn't request a courier.",
      }));
    } catch {
      setUberResult((prev) => ({ ...prev, [orderId]: "Couldn't request a courier — check your connection." }));
    }
    setUberBusy(null);
  };

  const cancelCourier = async (orderId: string) => {
    if (!window.confirm("Cancel the Uber courier for this order?")) return;
    setUberBusy(orderId);
    try {
      const res = await staffFetch("/api/delivery/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json();
      setUberResult((prev) => ({ ...prev, [orderId]: body.ok ? "Courier canceled." : body.error || "Couldn't cancel." }));
    } catch {
      setUberResult((prev) => ({ ...prev, [orderId]: "Couldn't cancel — check your connection." }));
    }
    setUberBusy(null);
  };

  const advance = async (o: Order, status: OrderStatus) => {
    await onStatusChange(o.id, status);
    if (status === "ready" && o.fulfillment === "delivery" && !o.uber_delivery_id) requestCourier(o.id);
  };

  useEffect(() => {
    fetch("/api/clover/status")
      .then((r) => r.json())
      .then((s) => setCloverConnected(Boolean(s.connected)))
      .catch(() => {});
  }, []);

  // Paid online orders go to Clover automatically; this is for retries.
  const sendToClover = async (orderId: string) => {
    setSending(orderId);
    try {
      const res = await staffFetch("/api/clover/push-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const body = await res.json();
      setSendResult((prev) => ({
        ...prev,
        [orderId]: body.ok ? `Sent to Clover${body.printed ? " and printed" : " (printer didn't respond)"}.` : body.error || "Couldn't send to Clover.",
      }));
    } catch {
      setSendResult((prev) => ({ ...prev, [orderId]: "Couldn't send to Clover — check your connection." }));
    }
    setSending(null);
  };

  const columns = useMemo(() => {
    const by: Record<"new" | "preparing" | "ready", Order[]> = { new: [], preparing: [], ready: [] };
    for (const o of orders) {
      const s = stageOf(o);
      if (s === "new") by.new.push(o);
      else if (s === "preparing") by.preparing.push(o);
      else if (s === "ready" || s === "out") by.ready.push(o);
    }
    const oldestFirst = (a: Order, b: Order) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    by.new.sort(oldestFirst);
    by.preparing.sort(oldestFirst);
    // Ready: pickups waiting and couriers still coming first, then ones on the road.
    by.ready.sort((a, b) => Number(stageOf(a) === "out") - Number(stageOf(b) === "out") || oldestFirst(a, b));
    return by;
  }, [orders]);

  const doneToday = useMemo(
    () =>
      orders
        .filter((o) => o.status === "completed" && isToday(o.completed_at ?? o.created_at))
        .sort((a, b) => new Date(b.completed_at ?? b.created_at).getTime() - new Date(a.completed_at ?? a.created_at).getTime()),
    [orders]
  );
  const history = useMemo(() => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [orders]);
  const liveCount = columns.new.length + columns.preparing.length + columns.ready.length;

  // ── One order card ──
  const card = (o: Order) => {
    const stage = stageOf(o);
    const next = NEXT_STATUS[o.status];
    const prev = PREV_STATUS[o.status];
    const t = timer(o, now);
    const ticks = new Set(packed[o.id] ?? []);
    const canPack = o.status === "new" || o.status === "preparing";
    const allPacked = o.items.length > 0 && o.items.every((_, i) => ticks.has(i));
    const itemCount = o.items.reduce((n, i) => n + i.qty, 0);
    const courierRunning = o.fulfillment === "delivery" && Boolean(o.uber_delivery_id) && COURIER_ACTIVE.has(o.uber_status ?? "");

    let primary: { label: string; sub: string; cls: string; status: OrderStatus } | null = null;
    if (next === "preparing") primary = { label: "Start preparing", sub: "Lets the customer know it's being packed", cls: "bg-gold text-gold-ink", status: next };
    if (next === "ready")
      primary = {
        label: "Mark ready",
        sub: o.fulfillment === "delivery" ? "Books the Uber courier" : "Texts the customer to come get it",
        cls: allPacked ? "bg-green text-white ring-4 ring-gold" : "bg-green text-white",
        status: next,
      };
    if (next === "completed" && !courierRunning)
      primary = {
        label: o.fulfillment === "delivery" ? "Delivered · done" : "Picked up · done",
        sub: o.fulfillment === "delivery" ? "Only if it was delivered without Uber" : "Customer has their order",
        cls: "bg-ink text-white",
        status: next,
      };

    return (
      <article
        key={o.id}
        className={`overflow-hidden rounded-2xl border-2 border-ink bg-paper ${stage === "new" ? "shadow-[4px_4px_0_var(--pink-deep)]" : ""}`}
      >
        <div className={`flex items-center justify-between gap-2 px-3.5 py-2 ${STRIP[stage]}`}>
          <span className="flex min-w-0 items-center gap-2 font-mono text-[0.62rem] font-bold uppercase tracking-widest">
            {(stage === "new" || stage === "out") && <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-current" />}
            <span className="truncate">{stripLabel(o)}</span>
          </span>
          <span className="shrink-0 font-mono text-[0.62rem] font-bold uppercase tracking-wide">{t.text}</span>
        </div>
        {t.late && (
          <p className="animate-pulse border-b-2 border-ink bg-pink-tint px-3.5 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-pink-deep">
            ⚠ {t.late}
          </p>
        )}

        <div className="px-3.5 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-poster text-2xl uppercase leading-none text-ink">#{o.id.slice(0, 6).toUpperCase()}</p>
            <p className="font-mono text-base font-bold text-ink">${o.subtotal.toFixed(2)}</p>
          </div>
          <p className="mt-1 font-body text-xs text-ink-soft">
            <span className={`mr-1.5 rounded-full px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide ${o.fulfillment === "delivery" ? "bg-ink text-white" : "bg-green-tint text-green-deep"}`}>
              {o.fulfillment === "delivery" ? "Delivery" : "Pickup"}
            </span>
            Ordered {clock(o.created_at)} · {itemCount} item{itemCount === 1 ? "" : "s"}
            {o.tax_amount ? ` · +$${Number(o.tax_amount).toFixed(2)} tax` : ""}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {o.contains_alcohol && <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-wide text-white">21+ · Check ID</span>}
            {o.discount_code && (
              <span className="rounded-full bg-pink-tint px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-wide text-pink-deep">
                {o.discount_code} −${Number(o.discount_amount ?? 0).toFixed(2)}
              </span>
            )}
            {o.refund_status && (
              <span className="rounded-full bg-[#a8461a]/10 px-2 py-0.5 font-mono text-[0.58rem] font-bold uppercase tracking-wide text-[#a8461a]">
                {o.refund_status === "full" ? "Refunded" : "Partly refunded"} ${Number(o.refunded_amount ?? 0).toFixed(2)}
              </span>
            )}
          </div>

          <div className="mt-3">
            <Progress o={o} />
          </div>

          {/* What to pack — tap to tick off while packing */}
          <div className="mt-3 rounded-xl border border-line bg-panel">
            <div className="flex items-center justify-between px-3 pt-2">
              <span className="font-mono text-[0.58rem] font-bold uppercase tracking-widest text-ink-soft">{canPack ? "Tap to tick off" : "Items"}</span>
              {canPack && (
                <span className={`font-mono text-[0.6rem] font-bold ${allPacked ? "text-green" : "text-ink-soft"}`}>
                  {allPacked ? "✓ All packed" : `${ticks.size}/${o.items.length} packed`}
                </span>
              )}
            </div>
            <ul className="px-1.5 pb-1.5 pt-1">
              {o.items.map((it, idx) => {
                const on = ticks.has(idx);
                return (
                  <li key={`${it.id}-${idx}`}>
                    <button
                      type="button"
                      disabled={!canPack}
                      onClick={() => togglePacked(o.id, idx)}
                      className={`flex w-full items-start gap-2.5 rounded-lg px-1.5 py-1.5 text-left font-body text-sm transition enabled:hover:bg-paper ${on ? "text-ink-soft line-through" : "text-ink"}`}
                    >
                      {canPack && (
                        <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 border-ink text-[0.6rem] font-bold ${on ? "bg-green text-white" : "bg-paper"}`}>
                          {on ? "✓" : ""}
                        </span>
                      )}
                      <span className="w-7 shrink-0 font-mono font-bold">{it.qty}×</span>
                      <span className="flex-1 leading-snug">{it.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {o.fulfillment === "delivery" && o.delivery_address && (
            <p className="mt-3 font-body text-xs text-ink">
              <span className="font-semibold">{o.delivery_address.name}</span> · {o.delivery_address.street}
              {o.delivery_address.apt ? `, ${o.delivery_address.apt}` : ""}, {o.delivery_address.zip}
              {o.delivery_address.notes && <span className="block text-ink-soft">“{o.delivery_address.notes}”</span>}
            </p>
          )}
          {o.phone && (
            <p className="mt-1.5 font-body text-xs text-ink-soft">
              <a href={`tel:${o.phone}`} className="font-mono font-bold text-ink underline decoration-line hover:text-green">
                {o.phone}
              </a>{" "}
              · {o.fulfillment === "delivery" ? "gets a tracking link when the courier is booked" : "texted when you mark it ready"}
            </p>
          )}

          {o.fulfillment === "delivery" && (
            <div className="mt-3">
              <UberBox
                o={o}
                busy={uberBusy === o.id}
                result={uberResult[o.id]}
                onRequest={() => requestCourier(o.id)}
                onCancel={() => cancelCourier(o.id)}
              />
            </div>
          )}

          {cloverConnected && !o.clover_order_id && o.clover_push_error && !sendResult[o.id] && (
            <p className="mt-2 font-body text-xs text-[#a8461a]">Clover: {o.clover_push_error}</p>
          )}
          {sendResult[o.id] && <p className="mt-2 font-body text-xs text-ink-soft">{sendResult[o.id]}</p>}

          {primary && (
            <div className="mt-3">
              <button
                onClick={() => advance(o, primary!.status)}
                className={`w-full rounded-full border-2 border-ink py-3 font-mono text-sm font-bold uppercase tracking-wide transition hover:-translate-y-0.5 active:translate-y-0 ${primary.cls}`}
              >
                {primary.label}
              </button>
              <p className="mt-1 text-center font-body text-[0.7rem] text-ink-soft">{primary.sub}</p>
            </div>
          )}

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            {prev && (
              <button onClick={() => onStatusChange(o.id, prev)} className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-ink">
                ← Back to {STATUS_LABEL[prev]}
              </button>
            )}
            {courierRunning && next === "completed" && (
              <button onClick={() => advance(o, "completed")} className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-ink">
                Mark done now
              </button>
            )}
            {cloverConnected && !o.clover_order_id && o.status !== "completed" && (
              <button
                onClick={() => sendToClover(o.id)}
                disabled={sending === o.id}
                className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-green disabled:opacity-60"
              >
                {sending === o.id ? "Sending…" : "Send to Clover"}
              </button>
            )}
            {o.clover_order_id && <span className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">On Clover ✓</span>}
          </div>
          {isOwner && (o.stripe_session_id || o.clover_payment_id) && (
            <div className="mt-2">
              <RefundBox order={o} onDone={() => onRefunded?.()} />
            </div>
          )}
        </div>
      </article>
    );
  };

  // A finished order, one line (Done today / History).
  const row = (o: Order) => {
    const count = o.items.reduce((n, i) => n + i.qty, 0);
    const s = stageOf(o);
    return (
      <details key={o.id} className="group border-b border-line last:border-b-0">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-panel">
          <span className={`w-20 shrink-0 rounded-full py-0.5 text-center font-mono text-[0.58rem] font-bold uppercase tracking-wide ${STRIP[s]} ${s === "done" ? "border border-line" : ""}`}>
            {s === "done" ? "Done" : s === "out" ? "Out" : STATUS_LABEL[o.status]}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-body text-sm font-semibold text-ink">
              #{o.id.slice(0, 6).toUpperCase()} · {count} item{count === 1 ? "" : "s"} · {o.fulfillment === "delivery" ? "Delivery" : "Pickup"}
            </span>
            <span className="block truncate font-body text-xs text-ink-soft">
              {new Date(o.created_at).toLocaleDateString([], { month: "short", day: "numeric" })} · ordered {clock(o.created_at)}
              {o.completed_at ? ` · done ${clock(o.completed_at)}` : ""}
              {o.completed_at ? ` (${dur(Math.round((new Date(o.completed_at).getTime() - new Date(o.created_at).getTime()) / 60000))} total)` : ""}
            </span>
          </span>
          <span className="font-mono text-sm font-bold text-ink">${o.subtotal.toFixed(2)}</span>
          <span aria-hidden className="text-xs text-ink-soft transition group-open:rotate-180">▾</span>
        </summary>
        <div className="px-4 pb-4">{card(o)}</div>
      </details>
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-full border-2 border-ink bg-paper p-1">
          {(
            [
              ["live", "Live board", liveCount],
              ["today", "Done today", doneToday.length],
              ["history", "History", null],
            ] as const
          ).map(([key, label, n]) => (
            <button
              key={key}
              onClick={() => setView(key)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-body text-sm font-semibold transition sm:px-4 ${
                view === key ? "bg-ink text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {label}
              {n !== null && <span className={`font-mono text-xs ${view === key ? "text-gold" : ""}`}>{n}</span>}
            </button>
          ))}
        </div>
        <p className="font-mono text-[0.6rem] font-bold uppercase tracking-widest text-ink-soft">
          <span className="mr-1.5 inline-block h-2 w-2 animate-pulse rounded-full bg-green align-middle" />
          Updates live
        </p>
      </div>

      {view === "live" && (
        <div className="mt-5 grid grid-cols-[minmax(0,1fr)] items-start gap-5 xl:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = columns[col.key];
            return (
              <section key={col.key} id={`col-${col.key}`} aria-label={col.title} className="flex scroll-mt-32 flex-col gap-3">
                <div className="flex items-end justify-between border-b-2 border-ink pb-2">
                  <div>
                    <h2 className="font-poster text-2xl uppercase leading-none text-ink">
                      {col.title} <span className="text-ink-soft">{list.length}</span>
                    </h2>
                    <p className="font-mono text-[0.58rem] font-bold uppercase tracking-widest text-ink-soft">{col.hint}</p>
                  </div>
                </div>
                {list.length === 0 ? (
                  <p className="rounded-2xl border-2 border-dashed border-line px-4 py-6 text-center font-body text-sm text-ink-soft">{col.empty}</p>
                ) : (
                  list.map(card)
                )}
              </section>
            );
          })}
        </div>
      )}

      {view === "today" && (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-ink bg-paper">
          {doneToday.length === 0 ? (
            <p className="px-4 py-10 text-center font-body text-sm text-ink-soft">No orders finished yet today.</p>
          ) : (
            doneToday.map(row)
          )}
        </div>
      )}

      {view === "history" && (
        <div className="mt-5 overflow-hidden rounded-2xl border-2 border-ink bg-paper">
          {history.length === 0 ? (
            <p className="px-4 py-10 text-center font-body text-sm text-ink-soft">No online orders yet.</p>
          ) : (
            <>
              {/* Grouped by the day each order was placed, newest first. */}
              {history.slice(0, historyLimit).map((o, i, list) => {
                const day = new Date(o.created_at).toDateString();
                const showHeader = i === 0 || new Date(list[i - 1].created_at).toDateString() !== day;
                const count = list.filter((x) => new Date(x.created_at).toDateString() === day).length;
                const label = isToday(o.created_at)
                  ? "Today"
                  : new Date(o.created_at).toDateString() === new Date(now - 86_400_000).toDateString()
                    ? "Yesterday"
                    : new Date(o.created_at).toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
                return (
                  <div key={o.id}>
                    {showHeader && (
                      <p className="flex items-center justify-between border-b-2 border-ink bg-panel px-4 py-2 font-mono text-[0.62rem] font-bold uppercase tracking-widest text-ink">
                        <span>{label}</span>
                        <span className="text-ink-soft">
                          {count} order{count === 1 ? "" : "s"}
                        </span>
                      </p>
                    )}
                    {row(o)}
                  </div>
                );
              })}
              {history.length > historyLimit && (
                <button onClick={() => setHistoryLimit((n) => n + 50)} className="w-full py-3 font-mono text-xs font-bold uppercase tracking-wide text-green hover:underline">
                  Show more
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
