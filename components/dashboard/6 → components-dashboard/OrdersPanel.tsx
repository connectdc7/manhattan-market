"use client";

import { useEffect, useMemo, useState } from "react";
import { Order, OrderStatus } from "@/lib/orders";

const UBER_LABEL: Record<string, string> = {
  pending: "Finding a courier",
  pickup: "Courier heading to store",
  pickup_complete: "Picked up",
  dropoff: "On the way to customer",
  delivered: "Delivered",
  canceled: "Courier canceled",
  returned: "Returned to store",
};
import { staffFetch } from "@/lib/staff-auth";

const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Completed",
};

const STATUS_BADGE: Record<OrderStatus, string> = {
  new: "bg-gold text-gold-ink",
  preparing: "bg-panel text-ink-soft border border-line",
  ready: "bg-green-tint text-green-deep",
  completed: "bg-line text-ink-soft",
};

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "preparing",
  preparing: "ready",
  ready: "completed",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  new: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Complete",
};

const PREV_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  preparing: "new",
  ready: "preparing",
  completed: "ready",
};

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

const STATUS_RANK: Record<OrderStatus, number> = { new: 0, preparing: 1, ready: 2, completed: 3 };

export default function OrdersPanel({
  orders,
  onStatusChange,
}: {
  orders: Order[];
  onStatusChange: (id: string, status: OrderStatus) => void | Promise<void>;
}) {
  const [view, setView] = useState<"active" | "completed" | "all">("active");
  const [cloverConnected, setCloverConnected] = useState(false);
  const [sending, setSending] = useState<string | null>(null);
  const [sendResult, setSendResult] = useState<Record<string, string>>({});
  const [uberBusy, setUberBusy] = useState<string | null>(null);
  const [uberResult, setUberResult] = useState<Record<string, string>>({});

  // Books an Uber courier for a delivery order (also called automatically
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
    if (status === "ready" && o.fulfillment === "delivery" && !o.uber_delivery_id) {
      requestCourier(o.id);
    }
  };

  useEffect(() => {
    fetch("/api/clover/status")
      .then((r) => r.json())
      .then((s) => setCloverConnected(Boolean(s.connected)))
      .catch(() => {});
  }, []);

  // Paid online orders go to Clover automatically; this is for retries and
  // for orders placed before Clover was connected.
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
        [orderId]: body.ok
          ? `Sent to Clover${body.printed ? " and printed" : " (printer didn't respond)"}.`
          : body.error || "Couldn't send to Clover.",
      }));
    } catch {
      setSendResult((prev) => ({ ...prev, [orderId]: "Couldn't send to Clover — check your connection." }));
    }
    setSending(null);
  };

  const shown = useMemo(() => {
    let list = orders;
    if (view === "active") list = list.filter((o) => o.status !== "completed");
    if (view === "completed") list = list.filter((o) => o.status === "completed");

    return [...list].sort((a, b) => {
      if (view === "active") {
        const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
        if (rankDiff !== 0) return rankDiff;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); // oldest first within a stage
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // newest first
    });
  }, [orders, view]);

  const activeCount = orders.filter((o) => o.status !== "completed").length;

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["active", `Active (${activeCount})`],
            ["completed", "Completed"],
            ["all", "All"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold transition ${
              view === key
                ? "border-green bg-green text-white"
                : "border-line text-ink-soft hover:border-green hover:text-green"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="mt-6 font-body text-sm text-ink-soft">
          {view === "active" ? "No active orders." : view === "completed" ? "Nothing completed yet." : "No orders placed yet."}
        </p>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          {shown.map((o) => {
            const next = NEXT_STATUS[o.status];
            const prev = PREV_STATUS[o.status];
            return (
              <div
                key={o.id}
                className={`rounded-lg border border-line p-4 ${o.status === "completed" ? "opacity-60" : ""}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${STATUS_BADGE[o.status]}`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${
                        o.fulfillment === "delivery" ? "bg-green-tint text-green-deep" : "bg-panel text-ink-soft"
                      }`}
                    >
                      {o.fulfillment}
                    </span>
                    <span className="font-mono text-xs text-ink-soft">{timeAgo(o.created_at)}</span>
                    {o.clover_order_id && (
                      <span className="rounded-full border border-line px-2.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-ink-soft">
                        On Clover
                      </span>
                    )}
                  </div>
                  <span className="font-mono text-sm font-semibold text-ink">${o.subtotal.toFixed(2)}</span>
                </div>
                <p className="mt-2 font-body text-sm text-ink-soft">
                  {o.items.map((it) => `${it.name} × ${it.qty}`).join(", ")}
                </p>
                {o.fulfillment === "delivery" && o.delivery_address && (
                  <div className="mt-2 rounded border border-line bg-panel px-3 py-2 font-body text-xs text-ink">
                    <p>
                      <span className="font-semibold">{o.delivery_address.name}</span> · {o.delivery_address.street}
                      {o.delivery_address.apt ? `, ${o.delivery_address.apt}` : ""}, {o.delivery_address.city}{" "}
                      {o.delivery_address.zip}
                      {o.delivery_fee ? <span className="text-ink-soft"> · paid ${o.delivery_fee.toFixed(2)} delivery</span> : null}
                      {o.service_fee ? <span className="text-ink-soft"> + ${o.service_fee.toFixed(2)} service fee</span> : null}
                    </p>
                    {o.delivery_address.notes && <p className="mt-0.5 text-ink-soft">“{o.delivery_address.notes}”</p>}
                    {o.uber_status && (
                      <p className="mt-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-green-deep">
                        Uber: {UBER_LABEL[o.uber_status] ?? o.uber_status}
                        {o.uber_courier?.name ? ` · ${o.uber_courier.name}` : ""}
                        {o.uber_courier?.vehicle_type ? ` (${o.uber_courier.vehicle_type})` : ""}
                        {o.uber_tracking_url && (
                          <>
                            {" · "}
                            <a href={o.uber_tracking_url} target="_blank" rel="noreferrer" className="underline">
                              Track
                            </a>
                          </>
                        )}
                      </p>
                    )}
                    {!uberResult[o.id] && o.uber_error && !(o.uber_status && o.uber_status !== "canceled") && (
                      <p className="mt-1 text-[#a8461a]">Uber: {o.uber_error}</p>
                    )}
                    {uberResult[o.id] && <p className="mt-1 text-ink-soft">{uberResult[o.id]}</p>}
                  </div>
                )}
                {o.phone && (
                  <p className="mt-1 font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
                    {o.phone} — {o.fulfillment === "delivery" ? "texted a tracking link when the courier is booked" : "texted when marked Ready"}
                  </p>
                )}
                {cloverConnected && !o.clover_order_id && o.clover_push_error && !sendResult[o.id] && (
                  <p className="mt-1 font-body text-xs text-[#a8461a]">Clover: {o.clover_push_error}</p>
                )}
                {sendResult[o.id] && <p className="mt-1 font-body text-xs text-ink-soft">{sendResult[o.id]}</p>}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {next && (
                    <button
                      onClick={() => advance(o, next)}
                      className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
                    >
                      {NEXT_LABEL[o.status]}
                    </button>
                  )}
                  {o.fulfillment === "delivery" &&
                    (o.status === "ready" || o.status === "preparing") &&
                    (!o.uber_delivery_id || o.uber_status === "canceled" || o.uber_status === "returned") && (
                      <button
                        onClick={() => requestCourier(o.id)}
                        disabled={uberBusy === o.id}
                        className="rounded-full border border-line px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green disabled:opacity-60"
                      >
                        {uberBusy === o.id ? "Requesting…" : "Request courier"}
                      </button>
                    )}
                  {o.uber_delivery_id && (o.uber_status === "pending" || o.uber_status === "pickup") && (
                    <button
                      onClick={() => cancelCourier(o.id)}
                      disabled={uberBusy === o.id}
                      className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a]"
                    >
                      Cancel courier
                    </button>
                  )}
                  {cloverConnected && !o.clover_order_id && o.status !== "completed" && (
                    <button
                      onClick={() => sendToClover(o.id)}
                      disabled={sending === o.id}
                      className="rounded-full border border-line px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green disabled:opacity-60"
                    >
                      {sending === o.id ? "Sending…" : "Send to Clover"}
                    </button>
                  )}
                  {prev && (
                    <button
                      onClick={() => onStatusChange(o.id, prev)}
                      className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-ink"
                    >
                      ← Back to {STATUS_LABEL[prev]}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
