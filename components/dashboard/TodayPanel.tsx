"use client";

import { useState } from "react";
import type { Order } from "@/lib/orders";
import type { Product } from "@/lib/products";
import type { CloverSale } from "@/lib/clover-stats";
import StatTile from "./StatTile";
import TileDetails, { TileKey } from "./TileDetails";
import OrderAlerts from "./OrderAlerts";
import { NavIcon, Section } from "./DashboardNav";

// The dashboard's front page: today's numbers, the orders waiting right
// now, and the two things staff reach for most (find a product, alerts).

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  new: { label: "New", cls: "bg-pink-deep text-white" },
  preparing: { label: "Preparing", cls: "bg-gold text-gold-ink" },
  ready: { label: "Ready", cls: "bg-green text-white" },
};

function minsAgo(iso: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : new Date(iso).toLocaleDateString();
}

export default function TodayPanel({
  showAlerts,
  salesToday,
  ordersTodayCount,
  activeOrders,
  lowStock,
  todaysSales,
  salesSource,
  statsNote,
  onGo,
}: {
  showAlerts: boolean;
  salesToday: number;
  ordersTodayCount: number;
  activeOrders: Order[];
  lowStock: Product[];
  todaysSales: CloverSale[];
  salesSource: string;
  statsNote: string;
  onGo: (section: Section, productSearch?: string) => void;
}) {
  const [openTile, setOpenTile] = useState<TileKey | null>(null);
  const [find, setFind] = useState("");
  const toggle = (k: TileKey) => setOpenTile((cur) => (cur === k ? null : k));
  const newCount = activeOrders.filter((o) => o.status === "new").length;
  const queue = [...activeOrders].sort((a, b) => {
    const rank = { new: 0, preparing: 1, ready: 2, completed: 3 } as const;
    return rank[a.status] - rank[b.status] || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Numbers */}
      <section>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile
            label="Sales today"
            value={`$${salesToday.toFixed(2)}`}
            sub="Register + online"
            tone="green"
            onClick={() => toggle("sales")}
            active={openTile === "sales"}
          />
          <StatTile
            label="Orders today"
            value={String(ordersTodayCount)}
            sub="Tap to see each sale"
            onClick={() => toggle("orders")}
            active={openTile === "orders"}
          />
          <StatTile
            label="Waiting now"
            value={String(activeOrders.length)}
            sub={newCount > 0 ? `${newCount} new — not started` : "Online orders in progress"}
            tone={activeOrders.length > 0 ? "gold" : "default"}
            onClick={() => onGo("orders")}
          />
          <StatTile
            label="Low stock"
            value={String(lowStock.length)}
            sub="3 or fewer left"
            tone={lowStock.length > 0 ? "warning" : "default"}
            onClick={() => toggle("lowstock")}
            active={openTile === "lowstock"}
          />
        </div>
        {openTile && (
          <TileDetails
            which={openTile}
            sales={todaysSales}
            salesSource={salesSource}
            lowStock={lowStock}
            onOpenInInventory={(name) => onGo("products", name)}
            onClose={() => setOpenTile(null)}
          />
        )}
        <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">{statsNote}</p>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        {/* Orders waiting */}
        <section className="rounded-2xl border-2 border-ink bg-paper">
          <div className="flex items-center justify-between gap-3 border-b-2 border-ink px-4 py-3">
            <h2 className="font-poster text-2xl uppercase leading-none text-ink">Up next</h2>
            <button
              type="button"
              onClick={() => onGo("orders")}
              className="font-mono text-xs font-bold uppercase tracking-wide text-green hover:underline"
            >
              All orders →
            </button>
          </div>
          {queue.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-green-tint text-green">
                <NavIcon name="orders" className="h-6 w-6" />
              </span>
              <p className="font-body text-sm font-semibold text-ink">All caught up</p>
              <p className="font-body text-xs text-ink-soft">New online orders show up here the moment they&apos;re paid.</p>
            </div>
          ) : (
            <ul>
              {queue.slice(0, 5).map((o) => {
                const st = STATUS_STYLE[o.status] ?? STATUS_STYLE.preparing;
                const count = o.items.reduce((n, i) => n + i.qty, 0);
                return (
                  <li key={o.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      onClick={() => onGo("orders")}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-panel"
                    >
                      <span className={`w-[5.5rem] shrink-0 rounded-full py-1 text-center font-mono text-[0.6rem] font-bold uppercase tracking-wide ${st.cls}`}>
                        {st.label}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-sm font-semibold text-ink">
                          #{o.id.slice(0, 6).toUpperCase()} · {count} item{count === 1 ? "" : "s"}
                          {o.contains_alcohol ? " · 21+" : ""}
                        </span>
                        <span className="block truncate font-body text-xs text-ink-soft">
                          {o.fulfillment === "delivery" ? "Delivery" : "Pickup"} · {minsAgo(o.created_at)}
                        </span>
                      </span>
                      <span className="font-mono text-sm font-bold text-ink">${o.subtotal.toFixed(2)}</span>
                    </button>
                  </li>
                );
              })}
              {queue.length > 5 && (
                <li className="px-4 py-2.5 text-center font-mono text-xs text-ink-soft">+{queue.length - 5} more in Orders</li>
              )}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-6">
          {/* Find a product */}
          <section className="rounded-2xl border-2 border-ink bg-gold-tint p-4">
            <h2 className="font-poster text-2xl uppercase leading-none text-ink">Find a product</h2>
            <p className="mt-1 font-body text-xs text-ink-soft">Check a price, fix a count, or take an item off the website.</p>
            <form
              className="mt-3 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                onGo("products", find.trim());
              }}
            >
              <input
                type="search"
                value={find}
                onChange={(e) => setFind(e.target.value)}
                placeholder="e.g. Fiji water"
                className="min-w-0 flex-1 rounded-full border-2 border-ink bg-paper px-4 py-2.5 font-body text-sm text-ink outline-none focus:ring-2 focus:ring-green"
              />
              <button
                type="submit"
                className="rounded-full border-2 border-ink bg-green px-4 font-mono text-xs font-bold uppercase tracking-wide text-white hover:bg-green-deep"
              >
                Search
              </button>
            </form>
          </section>

          {showAlerts && <OrderAlerts />}
        </div>
      </div>
    </div>
  );
}
