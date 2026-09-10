"use client";

import { useMemo, useState } from "react";
import { Order, OrderStatus } from "@/lib/orders";

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
  onStatusChange: (id: string, status: OrderStatus) => void;
}) {
  const [view, setView] = useState<"active" | "completed" | "all">("active");

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
                  </div>
                  <span className="font-mono text-sm font-semibold text-ink">${o.subtotal.toFixed(2)}</span>
                </div>
                <p className="mt-2 font-body text-sm text-ink-soft">
                  {o.items.map((it) => `${it.name} × ${it.qty}`).join(", ")}
                </p>
                <div className="mt-3 flex items-center gap-3">
                  {next && (
                    <button
                      onClick={() => onStatusChange(o.id, next)}
                      className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
                    >
                      {NEXT_LABEL[o.status]}
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
