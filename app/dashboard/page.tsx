"use client";

import { useEffect, useMemo, useState } from "react";
import { getProducts, Product } from "@/lib/products";
import { getCategories, Category } from "@/lib/categories";
import { getOrders, updateOrderStatus, notifyOrderReady, Order, OrderStatus } from "@/lib/orders";
import { getRewardsSignups, RewardsSignup } from "@/lib/rewards";
import { getHeroEffect, getHeroMedia, HeroEffect, HeroMedia } from "@/lib/hero";
import { isSupabaseConfigured } from "@/lib/supabase";
import { subscribeToDashboardChanges } from "@/lib/realtime";
import StatTile from "@/components/dashboard/StatTile";
import TileDetails, { TileKey } from "@/components/dashboard/TileDetails";
import type { CloverSale } from "@/lib/clover-stats";
import InventoryPanel from "@/components/dashboard/InventoryPanel";
import OrdersPanel from "@/components/dashboard/OrdersPanel";
import RewardsPanel from "@/components/dashboard/RewardsPanel";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";
import HeroPanel from "@/components/dashboard/HeroPanel";
import StaffPanel from "@/components/dashboard/StaffPanel";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import StaffGate from "@/components/dashboard/StaffGate";
import { signOutStaff, staffFetch, StaffMember } from "@/lib/staff-auth";
import type { CloverStats } from "@/lib/clover-stats";

type Tab = "orders" | "inventory" | "rewards" | "analytics" | "homepage" | "staff" | "settings";

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
}

// /dashboard requires a staff sign-in (see components/dashboard/StaffGate.tsx
// and supabase/staff-login.sql). Everything below only renders once a
// signed-in account on the staff list is confirmed.
export default function DashboardPage() {
  return <StaffGate>{(staff) => <Dashboard staff={staff} />}</StaffGate>;
}

function Dashboard({ staff }: { staff: StaffMember }) {
  const [tab, setTab] = useState<Tab>("orders");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signups, setSignups] = useState<RewardsSignup[]>([]);
  const [heroEffect, setHeroEffectState] = useState<HeroEffect>("petals");
  const [heroMedia, setHeroMedia] = useState<HeroMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  // Sales stats from Clover (register + online), when Clover is connected —
  // see app/api/clover/stats. null = not loaded / not connected, in which
  // case the tiles fall back to the website's own orders.
  const [cloverStats, setCloverStats] = useState<CloverStats | null>(null);
  const [cloverStatsError, setCloverStatsError] = useState<string | null>(null);
  // Which stat tile's drop-down is open, if any.
  const [openTile, setOpenTile] = useState<TileKey | null>(null);
  // Set when "Open in Inventory" is clicked from the Low Stock drop-down.
  const [inventorySearch, setInventorySearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await staffFetch("/api/clover/stats");
        const body = await res.json();
        if (cancelled) return;
        if (body.stats) {
          setCloverStats(body.stats);
          setCloverStatsError(null);
        } else if (body.error) {
          setCloverStatsError(body.error);
        }
      } catch {
        // offline for a moment — keep showing the last numbers
      }
    };
    load();
    const timer = setInterval(load, 2 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const loadAll = () => {
    Promise.all([
      getProducts(),
      getCategories(),
      getOrders(),
      getRewardsSignups(),
      getHeroEffect(),
      getHeroMedia(),
    ]).then(([p, c, o, s, he, hm]) => {
      setProducts(p);
      setCategories(c);
      setOrders(o);
      setSignups(s);
      setHeroEffectState(he);
      setHeroMedia(hm);
      setLoading(false);
    });
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
    const order = orders.find((o) => o.id === id);
    // Pickup orders get the "come pick it up" text. Delivery orders get a
    // tracking-link text instead, sent when the Uber courier is booked
    // (OrdersPanel requests the courier right after this).
    if (status === "ready" && order?.fulfillment !== "delivery") {
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
  const websiteSalesToday = ordersToday.reduce((sum, o) => sum + o.subtotal, 0);
  const salesToday = cloverStats ? cloverStats.salesToday : websiteSalesToday;
  const ordersTodayCount = cloverStats ? cloverStats.ordersToday : ordersToday.length;
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 3);
  const lowStockCount = lowStockProducts.length;
  const signupsTodayList = signups.filter((s) => isToday(s.created_at));
  const signupsToday = signupsTodayList.length;

  // What the Sales/Orders Today drop-down lists: Clover's sales when
  // connected, otherwise today's website orders in the same shape.
  const todaysSales: CloverSale[] = cloverStats
    ? cloverStats.todaysSales
    : ordersToday.map((o) => ({
        id: o.id,
        time: o.created_at,
        total: o.subtotal + (o.delivery_fee ?? 0) + (o.service_fee ?? 0),
        source: "online" as const,
        title: `WEB #${o.id.slice(0, 6).toUpperCase()}`,
        note: null,
        items: o.items.map((i) => ({ name: i.name, qty: i.qty, price: Number(i.price), refunded: false })),
      }));
  const toggleTile = (key: TileKey) => setOpenTile((cur) => (cur === key ? null : key));
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
          <button
            onClick={() => signOutStaff()}
            className="rounded-full border border-line px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green"
          >
            Sign out
          </button>
        </div>
      </div>
      <p className="mt-2 font-body text-sm text-ink-soft">
        Signed in as <span className="font-semibold text-ink">{staff.name || staff.email}</span>
        {staff.role === "owner" ? " · Owner" : ""}
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
            <StatTile
              label="Sales Today"
              value={`$${salesToday.toFixed(2)}`}
              onClick={() => toggleTile("sales")}
              active={openTile === "sales"}
            />
            <StatTile
              label="Orders Today"
              value={String(ordersTodayCount)}
              onClick={() => toggleTile("orders")}
              active={openTile === "orders"}
            />
            <StatTile
              label="Low Stock"
              value={String(lowStockCount)}
              tone={lowStockCount > 0 ? "warning" : "default"}
              onClick={() => toggleTile("lowstock")}
              active={openTile === "lowstock"}
            />
            <StatTile
              label="New Signups Today"
              value={String(signupsToday)}
              onClick={() => toggleTile("signups")}
              active={openTile === "signups"}
            />
          </div>

          {openTile && (
            <TileDetails
              which={openTile}
              sales={todaysSales}
              salesSource={
                cloverStats
                  ? "From Clover — register and online sales. Tap a sale to see what was in it."
                  : "From website orders only — Clover sales couldn't be loaded."
              }
              lowStock={lowStockProducts}
              signupsToday={signupsTodayList}
              onOpenInInventory={(name) => {
                setInventorySearch(name);
                setTab("inventory");
                setOpenTile(null);
              }}
              onClose={() => setOpenTile(null)}
            />
          )}
          <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">
            {cloverStats
              ? `Sales & orders from Clover — register + online · updated ${new Date(cloverStats.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
              : cloverStatsError
                ? `Couldn't load Clover sales (${cloverStatsError}) — showing website orders only`
                : "Sales & orders from website orders"}
          </p>

          <div className="mt-10 flex flex-wrap gap-2 border-b border-line pb-4">
            {(
              [
                ["orders", `Orders${activeOrderCount ? ` (${activeOrderCount})` : ""}`],
                ["inventory", "Inventory"],
                ["rewards", "Rewards"],
                ["analytics", "Analytics"],
                ["homepage", "Homepage"],
                ...(staff.role === "owner"
                  ? ([
                      ["staff", "Staff"],
                      ["settings", "Settings"],
                    ] as const)
                  : []),
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
                key={inventorySearch}
                initialSearch={inventorySearch}
                products={products}
                categories={categories}
                onStockSaved={handleStockSaved}
                onProductSaved={handleProductSaved}
                onProductRemoved={handleProductRemoved}
                onRefresh={loadAll}
                salesVelocity={salesVelocity}
              />
            )}
            {tab === "rewards" && <RewardsPanel signups={signups} />}
            {tab === "analytics" && <AnalyticsPanel orders={orders} cloverStats={cloverStats} cloverError={cloverStatsError} />}
            {tab === "homepage" && <HeroPanel effect={heroEffect} media={heroMedia} onRefresh={loadAll} />}
            {tab === "staff" && staff.role === "owner" && <StaffPanel me={staff} />}
            {tab === "settings" && staff.role === "owner" && <SettingsPanel />}
          </div>
        </>
      )}
    </div>
  );
}
