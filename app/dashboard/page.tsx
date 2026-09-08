"use client";

import { useEffect, useState } from "react";
import { getProducts, updateProductStock, Product } from "@/lib/products";
import { getOrders, Order } from "@/lib/orders";
import { getRewardsSignups, RewardsSignup } from "@/lib/rewards";
import { isSupabaseConfigured } from "@/lib/supabase";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString();
}

function StockCell({ product, onSaved }: { product: Product; onSaved: (id: string, stock: number) => void }) {
  const [value, setValue] = useState(String(product.stock));
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const dirty = Number(value) !== product.stock;

  const save = async () => {
    const next = Math.max(0, Math.floor(Number(value) || 0));
    setValue(String(next));
    setSaving(true);
    const ok = await updateProductStock(product.id, next);
    setSaving(false);
    if (ok) {
      onSaved(product.id, next);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1200);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-20 rounded border border-line bg-paper px-2 py-1 font-mono text-sm text-ink outline-none focus:border-green"
      />
      {dirty && (
        <button
          onClick={save}
          disabled={saving}
          className="rounded-full bg-green px-3 py-1 font-mono text-[0.68rem] font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      )}
      {savedFlash && <span className="font-mono text-[0.65rem] text-green">Saved</span>}
    </div>
  );
}

export default function DashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [signups, setSignups] = useState<RewardsSignup[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = () => {
    Promise.all([getProducts(), getOrders(), getRewardsSignups()]).then(([p, o, s]) => {
      setProducts(p);
      setOrders(o);
      setSignups(s);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleStockSaved = (id: string, stock: number) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, stock } : p)));
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-12">
      <p className="eyebrow text-green">Staff Only</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">Employee Dashboard</h1>
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
        <div className="mt-10 flex flex-col gap-12">
          {/* Inventory & stock */}
          <section>
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-display text-xl font-bold text-ink">Inventory &amp; Stock</h2>
              <button
                onClick={loadAll}
                className="font-mono text-xs font-semibold text-ink-soft hover:text-green"
              >
                Refresh
              </button>
            </div>
            <div className="mt-4 overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[560px] border-collapse font-body text-sm">
                <thead>
                  <tr className="border-b border-line bg-panel text-left">
                    <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Product</th>
                    <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Category</th>
                    <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Price</th>
                    <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p.id} className="border-b border-line last:border-none">
                      <td className="px-4 py-2.5 text-ink">{p.name}</td>
                      <td className="px-4 py-2.5 text-ink-soft">{p.category}</td>
                      <td className="px-4 py-2.5 font-mono text-ink-soft">${p.price.toFixed(2)}</td>
                      <td className="px-4 py-2.5">
                        <StockCell product={p} onSaved={handleStockSaved} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* Recent orders */}
          <section>
            <h2 className="font-display text-xl font-bold text-ink">Recent Orders</h2>
            {orders.length === 0 ? (
              <p className="mt-3 font-body text-sm text-ink-soft">No orders placed yet.</p>
            ) : (
              <div className="mt-4 flex flex-col gap-3">
                {orders.map((o) => (
                  <div key={o.id} className="rounded-lg border border-line p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[0.65rem] font-semibold uppercase tracking-wide ${
                            o.fulfillment === "delivery"
                              ? "bg-green-tint text-green-deep"
                              : "bg-panel text-ink-soft"
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
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Rewards signups */}
          <section>
            <h2 className="font-display text-xl font-bold text-ink">Rewards Signups</h2>
            {signups.length === 0 ? (
              <p className="mt-3 font-body text-sm text-ink-soft">No signups yet.</p>
            ) : (
              <div className="mt-4 overflow-hidden rounded-lg border border-line">
                <table className="w-full border-collapse font-body text-sm">
                  <tbody>
                    {signups.map((s) => (
                      <tr key={s.id} className="border-b border-line last:border-none">
                        <td className="px-4 py-2.5 text-ink">{s.contact}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-xs text-ink-soft">
                          {timeAgo(s.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
