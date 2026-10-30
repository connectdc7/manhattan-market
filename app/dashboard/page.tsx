"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getProducts, Product } from "@/lib/products";
import { getCategories, Category } from "@/lib/categories";
import { getOrders, updateOrderStatus, notifyOrderReady, Order, OrderStatus } from "@/lib/orders";
import { getHeroEffect, getHeroMedia, HeroEffect, HeroMedia } from "@/lib/hero";
import { isSupabaseConfigured } from "@/lib/supabase";
import { subscribeToDashboardChanges } from "@/lib/realtime";
import type { CloverSale } from "@/lib/clover-stats";
import InventoryPanel from "@/components/dashboard/InventoryPanel";
import OrdersPanel from "@/components/dashboard/OrdersPanel";
import AnalyticsPanel from "@/components/dashboard/AnalyticsPanel";
import HeroPanel from "@/components/dashboard/HeroPanel";
import GalleryPanel from "@/components/dashboard/GalleryPanel";
import StaffPanel from "@/components/dashboard/StaffPanel";
import SettingsPanel from "@/components/dashboard/SettingsPanel";
import StaffGate from "@/components/dashboard/StaffGate";
import TodayPanel from "@/components/dashboard/TodayPanel";
import StoreSetupPanel from "@/components/dashboard/StoreSetupPanel";
import { BottomNav, Section, sectionsFor, SECTIONS, SideNav } from "@/components/dashboard/DashboardNav";
import { SkylineWordmark } from "@/components/Logo";
import { getStoreStatus } from "@/lib/store-hours";
import { NewOrderBanner, OrderCounts, SoundButton, useOrderChime } from "@/components/dashboard/OrderPulse";
import { turnOffAlerts } from "@/lib/push-client";
import { returnToOwner, signOutStaff, staffFetch, StaffMember, viewingAsStaff } from "@/lib/staff-auth";
import type { CloverStats } from "@/lib/clover-stats";


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
  const isOwner = staff.role === "owner";
  // Which page of the dashboard is open — kept in the address (#orders) so a
  // refresh or the phone's back button stays put.
  const [section, setSectionState] = useState<Section>(() => {
    // Opens on the live orders board — online orders are the main job.
    if (typeof window === "undefined") return "orders";
    const fromHash = window.location.hash.slice(1) as Section;
    return sectionsFor(isOwner).some((s) => s.key === fromHash) ? fromHash : "orders";
  });
  const setSection = (next: Section) => {
    setSectionState(next);
    try {
      window.history.replaceState(null, "", `#${next}`);
    } catch {
      // ignore
    }
    window.scrollTo({ top: 0 });
  };
  // Set when an owner opened this dashboard "as" a staff member (Staff tab).
  const [viewingAs] = useState(() => viewingAsStaff());
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [heroEffect, setHeroEffectState] = useState<HeroEffect>("petals");
  const [heroMedia, setHeroMedia] = useState<HeroMedia[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  // Sales stats from Clover (register + online), when Clover is connected —
  // see app/api/clover/stats. null = not loaded / not connected, in which
  // case the tiles fall back to the website's own orders.
  const [cloverStats, setCloverStats] = useState<CloverStats | null>(null);
  const [cloverStatsError, setCloverStatsError] = useState<string | null>(null);
  // Set when a search is started from Today (or "Open in Products").
  const [inventorySearch, setInventorySearch] = useState("");

  // ── New online orders: chime + banner ──
  // Orders already there when the dashboard opened don't ring; anything that
  // arrives after does (see components/dashboard/OrderPulse.tsx).
  const chime = useOrderChime();
  const soundOnRef = useRef(chime.soundOn);
  const playRef = useRef(chime.play);
  useEffect(() => {
    soundOnRef.current = chime.soundOn;
    playRef.current = chime.play;
  }, [chime.soundOn, chime.play]);
  const seenRef = useRef<Set<string> | null>(null);
  const ordersRef = useRef<Order[]>([]);
  const [incoming, setIncoming] = useState<string[]>([]);
  const receiveOrders = (list: Order[]) => {
    setOrders(list);
    ordersRef.current = list;
    if (seenRef.current === null) {
      seenRef.current = new Set(list.map((o) => o.id));
      return;
    }
    const seen = seenRef.current;
    const fresh = list.filter((o) => !seen.has(o.id) && o.status === "new");
    for (const o of list) seen.add(o.id);
    if (fresh.length) {
      setIncoming((prev) => [...fresh.map((o) => o.id), ...prev]);
      if (soundOnRef.current) playRef.current();
    }
  };

  // Backup for the live connection: re-check orders every 30 seconds, and
  // ring again every minute while an order sits unstarted for 2+ minutes.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const poll = setInterval(() => {
      getOrders().then(receiveOrders).catch(() => {});
    }, 30_000);
    const nag = setInterval(() => {
      const waiting = ordersRef.current.some((o) => o.status === "new" && Date.now() - new Date(o.created_at).getTime() > 2 * 60_000);
      if (waiting && soundOnRef.current) playRef.current();
    }, 60_000);
    return () => {
      clearInterval(poll);
      clearInterval(nag);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      getHeroEffect(),
      getHeroMedia(),
    ]).then(([p, c, o, he, hm]) => {
      setProducts(p);
      setCategories(c);
      receiveOrders(o);
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
    const stamp = new Date().toISOString();
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              status,
              ...(status === "preparing" ? { preparing_at: stamp } : status === "ready" ? { ready_at: stamp } : status === "completed" ? { completed_at: stamp } : {}),
            }
          : o
      )
    );
    setIncoming((prev) => prev.filter((x) => x !== id));
    await updateOrderStatus(id, status);
    const order = orders.find((o) => o.id === id);
    // Pickup orders get the "come pick it up" text. Delivery orders get a
    // tracking-link text instead, sent when the Uber courier is booked
    // (OrdersPanel requests the courier right after this).
    if (status === "ready" && order?.fulfillment !== "delivery") {
      notifyOrderReady(id, order?.phone);
    }
    // Completed → mark it Paid and closed on Clover too (lib/clover-complete.ts).
    if (status === "completed" && order?.clover_order_id) {
      staffFetch("/api/clover/complete-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: id }),
      }).catch(() => {});
    }
  };

  // Units sold per product over the last 7 days, in units/day — lets the
  // Inventory tab flag a fast-moving item before it hits a fixed low-stock
  // threshold, instead of only after.
  const [openedAt] = useState(() => Date.now());
  const salesVelocity = useMemo(() => {
    const cutoff = openedAt - 7 * 24 * 60 * 60 * 1000;
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
  }, [orders, openedAt]);

  const ordersToday = orders.filter((o) => isToday(o.created_at));
  const websiteSalesToday = ordersToday.reduce((sum, o) => sum + o.subtotal, 0);
  const salesToday = cloverStats ? cloverStats.salesToday : websiteSalesToday;
  const ordersTodayCount = cloverStats ? cloverStats.ordersToday : ordersToday.length;
  const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 3);

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
  const activeOrders = orders.filter((o) => o.status !== "completed");
  const newOrders = activeOrders.filter((o) => o.status === "new").length;
  // Browser tab shows "(2) New order" so it's noticed from another tab too.
  useEffect(() => {
    document.title = newOrders > 0 ? `(${newOrders}) New order${newOrders === 1 ? "" : "s"} · MM Staff` : "Live orders · MM Staff";
  }, [newOrders]);
  const statsNote = cloverStats
    ? `Sales & orders from Clover — register + online · updated ${new Date(cloverStats.generatedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
    : cloverStatsError
      ? `Couldn't load Clover sales (${cloverStatsError}) — showing website orders only`
      : "Sales & orders from website orders";

  const meta = SECTIONS.find((s) => s.key === section) ?? SECTIONS[0];
  const firstName = (staff.name || staff.email || "").split(/[\s@]/)[0];
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const store = getStoreStatus();
  const goTo = (next: Section, productSearch?: string) => {
    if (next === "products" && productSearch !== undefined) setInventorySearch(productSearch);
    setSection(next);
  };
  const bannerOrders = incoming.map((id) => orders.find((o) => o.id === id)).filter((o): o is Order => Boolean(o && o.status === "new"));

  // Tapping a count in the top bar jumps to that column of the board.
  const openColumn = (col: "new" | "preparing" | "ready") => {
    if (section !== "orders") setSection("orders");
    setTimeout(() => document.getElementById(`col-${col}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };

  const signOut = () =>
    viewingAs ? returnToOwner().finally(() => window.location.reload()) : turnOffAlerts().finally(() => signOutStaff());

  return (
    <div className="min-h-screen bg-panel">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b-2 border-ink bg-bodega-tiles text-white">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button type="button" onClick={() => setSection("orders")} className="flex shrink-0 items-center gap-3" aria-label="Live orders">
            <SkylineWordmark className="h-10 w-auto text-white" />
            <span className="rounded-full border-2 border-ink bg-gold px-2.5 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-gold-ink">
              Staff
            </span>
          </button>
          {!loading && <OrderCounts orders={orders} onOpen={openColumn} className="ml-2 hidden md:flex" />}
          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <SoundButton on={chime.soundOn} onToggle={chime.toggle} />
            {isSupabaseConfigured && !loading && (
              <span
                title={live ? "Updates appear the moment they happen" : "Connected"}
                className="hidden items-center gap-1.5 rounded-full border border-white/30 px-3 py-1 font-mono text-[0.6rem] font-bold uppercase tracking-widest text-white/85 xl:flex"
              >
                <span className={`h-2 w-2 rounded-full ${live ? "animate-pulse bg-gold" : "bg-white/50"}`} />
                {live ? "Live" : "Connected"}
              </span>
            )}
            <span className="hidden text-right leading-tight xl:block">
              <span className="block font-body text-sm font-semibold">{staff.name || staff.email}</span>
              <span className="block font-mono text-[0.6rem] uppercase tracking-widest text-white/65">{isOwner ? "Owner" : "Staff"}</span>
            </span>
            <button
              onClick={signOut}
              className="rounded-full border-2 border-white/70 px-3.5 py-1.5 font-mono text-[0.65rem] font-bold uppercase tracking-wide text-white transition hover:border-white hover:bg-white/10"
            >
              {viewingAs ? "Back to me" : "Sign out"}
            </button>
          </div>
        </div>
        {/* Phone: live order counts on their own row */}
        {!loading && (
          <div className="overflow-x-auto border-t border-white/15 px-4 py-2 md:hidden">
            <OrderCounts orders={orders} onOpen={openColumn} />
          </div>
        )}
      </header>

      <NewOrderBanner
        orders={bannerOrders}
        onStart={(o) => handleStatusChange(o.id, "preparing")}
        onView={() => {
          setIncoming([]);
          setSection("orders");
        }}
        onDismiss={() => setIncoming([])}
      />

      {viewingAs && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-ink bg-gold px-4 py-2.5 sm:px-6">
          <p className="font-body text-sm font-semibold text-gold-ink">
            You&apos;re viewing the dashboard as {viewingAs.viewing}. Anything you change is saved as them.
          </p>
          <button
            type="button"
            onClick={() => returnToOwner().finally(() => window.location.reload())}
            className="rounded-full bg-ink px-4 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-white hover:bg-green-deep"
          >
            Back to my account
          </button>
        </div>
      )}

      <div className="flex">
        {/* Side menu (tablet & computer) */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-60 shrink-0 border-r-2 border-ink bg-paper md:block">
          <SideNav current={section} onSelect={setSection} isOwner={isOwner} activeOrders={activeOrders.length} newOrders={newOrders} />
        </aside>

        <main className="min-w-0 flex-1 px-4 pb-32 pt-6 sm:px-6 md:pb-12 lg:px-10">
          <div className="mx-auto max-w-6xl">
            {/* Page heading */}
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <div>
                {section === "today" ? (
                  <>
                    <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-green">
                      {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} ·{" "}
                      {store.isOpen ? `Open until ${store.closesAt}` : "Store closed"}
                    </p>
                    <h1 className="font-poster mt-1 text-4xl uppercase leading-none text-ink sm:text-5xl">
                      {greeting}
                      {firstName ? `, ${firstName}` : ""}
                    </h1>
                  </>
                ) : (
                  <>
                    <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-green">{meta.hint}</p>
                    <h1 className="font-poster mt-1 text-4xl uppercase leading-none text-ink sm:text-5xl">{meta.label}</h1>
                  </>
                )}
              </div>
            </div>

            {!isSupabaseConfigured ? (
              <div className="rounded-2xl border-2 border-ink bg-paper p-8 text-center">
                <p className="font-poster text-2xl uppercase text-ink">Connect Supabase to use this page</p>
                <p className="mt-2 font-body text-sm text-ink-soft">
                  The dashboard reads and writes real data — inventory, orders and settings — so it needs Supabase configured to show anything.
                  Follow the setup steps in the README, then reload this page.
                </p>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Loading dashboard">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-28 animate-pulse rounded-2xl border-2 border-line bg-paper" />
                ))}
              </div>
            ) : (
              <>
                {section === "today" && (
                  <TodayPanel
                    showAlerts={!viewingAs}
                    salesToday={salesToday}
                    ordersTodayCount={ordersTodayCount}
                    activeOrders={activeOrders}
                    lowStock={lowStockProducts}
                    todaysSales={todaysSales}
                    salesSource={
                      cloverStats
                        ? "From Clover — register and online sales. Tap a sale to see what was in it."
                        : "From website orders only — Clover sales couldn't be loaded."
                    }
                    statsNote={statsNote}
                    onGo={goTo}
                  />
                )}
                {section === "orders" && (
                  <OrdersPanel orders={orders} onStatusChange={handleStatusChange} isOwner={isOwner} onRefunded={loadAll} />
                )}
                {section === "products" && (
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
                    isOwner={isOwner}
                  />
                )}
                {isOwner && section === "sales" && (
                  <AnalyticsPanel orders={orders} cloverStats={cloverStats} cloverError={cloverStatsError} />
                )}
                {isOwner && section === "setup" && <StoreSetupPanel products={products} categories={categories} onRefresh={loadAll} />}
                {isOwner && section === "homepage" && <HeroPanel effect={heroEffect} media={heroMedia} onRefresh={loadAll} />}
                {isOwner && section === "gallery" && <GalleryPanel />}
                {isOwner && section === "staff" && <StaffPanel me={staff} />}
                {isOwner && section === "settings" && <SettingsPanel />}
              </>
            )}
          </div>
        </main>
      </div>

      <BottomNav current={section} onSelect={setSection} isOwner={isOwner} activeOrders={activeOrders.length} newOrders={newOrders} />
    </div>
  );
}
