"use client";

import { useEffect, useMemo, useState } from "react";
import { getProducts, Product } from "@/lib/products";
import { getOrders, updateOrderStatus, notifyOrderReady, Order, OrderStatus } from "@/lib/orders";
import { getRewardsSignups, RewardsSignup } from "@/lib/rewards";
import { getPendingRestockCounts } from "@/lib/restock";
import { isSupabaseConfigured } from "@/lib/supabase";
import { subscribeToDashboardChanges } from "@/lib/realtime";
import StatTile from "@/components/dashboard/StatTile";
import InventoryPanel from "@/components/dashboard/InventoryPanel";
import OrdersPanel from "@/components/dashboard/OrdersPanel";
import RewardsPanel from "@/components/dashboard/RewardsPanel";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";

type Tab = "orders" | "inventory" | "rewards" | "analytics";

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

export default function DashboardPage() {
  const [tab, setTab] = useState<Tab>("orders");
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signups, setSignups] = useState<RewardsSignup[]>([]);
  const [restockCounts, setRestockCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);

  const loadAll = () => {
    Promise.all([getProducts(), getOrders(), getRewardsSignups(), getPendingRestockCounts()]).then(
      ([p, o, s, r]) => {
        setProducts(p);
        setOrders(o);
        setSignups(s);
        setRestockCounts(r);
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    loadAll();

    if (!isSupabaseConfigured) return;

    // Coalesce bursts (e.g. checkout firing a products change and an
    // orders change within milliseconds of each other) into one refetch.
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const onChange = () => {
      setLive(true);
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(loadAll, 400);
    };

    const unsubscribe = subscribeToDashboardChanges(onChange);
    return () => {
      if (debounce) clearTimeout(debounce);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStockSaved = (id: string, stock: number) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock } : p)));
  };

  const handleProductSaved = (product: Product) => {
    setProducts((prev) => {
      const exists = prev.some((p) => p.id === product.id);
      const next = exists ? prev.map((p) => (p.id === product.id ? product : p)) : [...prev, product];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  };

  const handleProductRemoved = (id: string) => {
    setProducts((prev) => prev.filter((p) => p.id !== id));
  };

  const handleStatusChange = async (id: string, status: OrderStatus) => {
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o)));
    await updateOrderStatus(id, status);
    if (status === "ready") {
      const order = orders.find((o) => o.id === id);
      notifyOrderReady(id, order?.phone);
    }
  };

  // Units sold per product over the last 7 days, in units/day — lets the
  // Inventory tab flag a fast-moving item before it hits a fixed low-stock
  // threshold, instead of only after.
  const salesVelocity = useMemo(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const unitsByProduct: Record<string, number> = {};
    for (const o of orders) {
      if (new Date(o.created_at).getTime() < cutoff) continue;
      for (const item of o.items) {
        unitsByProduct[item.id] = (unitsByProduct[item.id] ?? 0) + item.qty;
      }
    }
    const velocity: Record<string, number> = {};
    for (const [id, units] of Object.entries(unitsByProduct)) {
      velocity[id] = units / 7;
    }
    return velocity;
  }, [orders]);

  const ordersToday = orders.filter((o) => isToday(o.created_at));
  const salesToday = ordersToday.reduce((sum, o) => sum + o.subtotal, 0);
  const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= 3).length;
  const signupsToday = signups.filter((s) => isToday(s.created_at)).length;
  const activeOrderCount = orders.filter((o) => o.status !== "completed").length;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow text-green">Staff Only</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Employee Dashboard</h1>
        </div>
        <div className="flex items-center gap-2">
          {isSupabaseConfigured && !loading && (
            <span className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1 font-mono text-[0.65rem] font-semibold uppercase tracking-wide text-ink-soft">
              <span className={`h-1.5 w-1.5 rounded-full ${live ? "bg-green" : "bg-line"}`} />
              {live ? "Live" : "Connected"}
            </span>
          )}
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-line px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green"
          >
            View Storefront ↗
          </a>
        </div>
      </div>
      <p className="mt-2 max-w-2xl font-body text-sm text-ink-soft">
        Not linked anywhere in the site nav — this page is reachable only if you have the
        URL. It has no login yet, so treat it as a demo, not a place for real customer
        data. See the note at the top of <code className="font-mono text-xs">supabase/seed.sql</code> before
        this goes live.
      </p>

      {!isSupabaseConfigured ? (
        <div className="mt-10 rounded-lg border border-line bg-panel p-8 text-center">
          <p className="font-display text-lg font-bold text-ink">Connect Supabase to use this page</p>
          <p className="mt-2 font-body text-sm text-ink-soft">
            The dashboard reads and writes real data — inventory, orders, rewards
            signups — so it needs Supabase configured to show anything. Follow the
            setup steps in the README, then reload this page.
          </p>
        </div>
      ) : loading ? (
        <p className="mt-10 font-mono text-xs uppercase tracking-wide text-ink-soft">Loading dashboard…</p>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Sales Today" value={`$${salesToday.toFixed(2)}`} />
            <StatTile label="Orders Today" value={String(ordersToday.length)} />
            <StatTile
              label="Low Stock"
              value={String(lowStockCount)}
              tone={lowStockCount > 0 ? "warning" : "default"}
            />
            <StatTile label="New Signups Today" value={String(signupsToday)} />
          </div>

          <div className="mt-10 flex flex-wrap gap-2 border-b border-line pb-4">
            {(
              [
                ["orders", `Orders${activeOrderCount ? ` (${activeOrderCount})` : ""}`],
                ["inventory", "Inventory"],
                ["rewards", "Rewards"],
                ["analytics", "Analytics"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`rounded-full px-4 py-1.5 font-mono text-xs font-semibold transition ${
                  tab === key ? "bg-green text-white" : "text-ink-soft hover:text-green"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {tab === "orders" && <OrdersPanel orders={orders} onStatusChange={handleStatusChange} />}
            {tab === "inventory" && (
              <InventoryPanel
                products={products}
                onStockSaved={handleStockSaved}
                onProductSaved={handleProductSaved}
                onProductRemoved={handleProductRemoved}
                onRefresh={loadAll}
                salesVelocity={salesVelocity}
                restockCounts={restockCounts}
                onRestockNotified={loadAll}
              />
            )}
            {tab === "rewards" && <RewardsPanel signups={signups} />}
            {tab === "analytics" && <AnalyticsPanel orders={orders} />}
          </div>
        </>
      )}
    </div>
  );
}
