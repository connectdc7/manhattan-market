"use client";

import { useMemo } from "react";
import { Order } from "@/lib/orders";
import StatTile from "./StatTile";

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatHour(hour: number) {
  const period = hour >= 12 ? "pm" : "am";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}${period}`;
}

export default function AnalyticsPanel({ orders }: { orders: Order[] }) {
  const stats = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    let salesToday = 0;
    let salesYesterday = 0;
    let ordersToday = 0;
    let ordersYesterday = 0;

    const qtyByProduct = new Map<string, number>();
    const revenueByProduct = new Map<string, number>();
    const countByHour = new Array(24).fill(0);

    for (const o of orders) {
      const created = new Date(o.created_at);
      if (isSameDay(created, now)) {
        salesToday += o.subtotal;
        ordersToday += 1;
      } else if (isSameDay(created, yesterday)) {
        salesYesterday += o.subtotal;
        ordersYesterday += 1;
      }
      countByHour[created.getHours()] += 1;

      for (const item of o.items) {
        qtyByProduct.set(item.name, (qtyByProduct.get(item.name) ?? 0) + item.qty);
        revenueByProduct.set(item.name, (revenueByProduct.get(item.name) ?? 0) + item.price * item.qty);
      }
    }

    const ranked = Array.from(qtyByProduct.entries())
      .map(([name, qty]) => ({ name, qty, revenue: revenueByProduct.get(name) ?? 0 }))
      .sort((a, b) => b.qty - a.qty);

    const bestSellers = ranked.slice(0, 5);
    const slowMovers = ranked.slice(-5).reverse();

    const maxHourCount = Math.max(1, ...countByHour);
    const salesDelta =
      salesYesterday > 0 ? ((salesToday - salesYesterday) / salesYesterday) * 100 : salesToday > 0 ? 100 : 0;

    return {
      salesToday,
      salesYesterday,
      ordersToday,
      ordersYesterday,
      salesDelta,
      bestSellers,
      slowMovers,
      countByHour,
      maxHourCount,
      hasOrders: orders.length > 0,
    };
  }, [orders]);

  if (!stats.hasOrders) {
    return <p className="mt-6 font-body text-sm text-ink-soft">No order history yet — analytics will build up as orders come in.</p>;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Sales Today" value={`$${stats.salesToday.toFixed(2)}`} />
        <StatTile label="Sales Yesterday" value={`$${stats.salesYesterday.toFixed(2)}`} />
        <StatTile
          label="Vs. Yesterday"
          value={`${stats.salesDelta >= 0 ? "+" : ""}${stats.salesDelta.toFixed(0)}%`}
          tone={stats.salesDelta < 0 ? "warning" : "default"}
        />
        <StatTile label="Orders Today" value={String(stats.ordersToday)} />
      </div>

      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
          Orders by hour of day (all history loaded)
        </p>
        <div className="mt-3 overflow-x-auto">
          <div className="flex min-w-[640px] items-end gap-1" style={{ height: 120 }}>
            {stats.countByHour.map((count, hour) => (
              <div key={hour} className="flex flex-1 flex-col items-center gap-1" title={`${formatHour(hour)}: ${count} order${count === 1 ? "" : "s"}`}>
                <div
                  className="w-full rounded-t bg-green"
                  style={{ height: `${Math.max(2, (count / stats.maxHourCount) * 96)}px` }}
                />
                {hour % 3 === 0 && (
                  <span className="font-mono text-[0.55rem] text-ink-soft">{formatHour(hour)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Best sellers</p>
          <div className="mt-3 flex flex-col gap-2">
            {stats.bestSellers.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-32 flex-shrink-0 truncate font-body text-sm text-ink">{p.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full bg-green"
                    style={{ width: `${(p.qty / stats.bestSellers[0].qty) * 100}%` }}
                  />
                </div>
                <span className="w-16 flex-shrink-0 text-right font-mono text-xs text-ink-soft">{p.qty} sold</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Slow movers</p>
          <div className="mt-3 flex flex-col gap-2">
            {stats.slowMovers.map((p) => (
              <div key={p.name} className="flex items-center gap-2">
                <span className="w-32 flex-shrink-0 truncate font-body text-sm text-ink">{p.name}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel">
                  <div
                    className="h-full rounded-full bg-[#a8461a]/60"
                    style={{ width: `${Math.max(6, (p.qty / stats.bestSellers[0].qty) * 100)}%` }}
                  />
                </div>
                <span className="w-16 flex-shrink-0 text-right font-mono text-xs text-ink-soft">{p.qty} sold</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="font-mono text-[0.62rem] uppercase tracking-wide text-ink-soft">
        Based on the most recent {orders.length} order{orders.length === 1 ? "" : "s"} loaded.
      </p>
    </div>
  );
}
