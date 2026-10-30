"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { updateProductStock, setProductSpecial, setProductHealthy, setProductHiddenOnline, Product } from "@/lib/products";
import { Category } from "@/lib/categories";
import { rankProducts } from "@/lib/search";
import ProductFormModal from "./ProductFormModal";

// Dashboard → Products. Built for the counter: search, see what's on the
// shelf, fix a count, take something off the website. Owner extras (add a
// product, specials) sit beside it; store setup tools live in StoreSetupPanel.

function StockStepper({ product, onSaved }: { product: Product; onSaved: (id: string, stock: number) => void }) {
  const [value, setValue] = useState(product.stock);
  const [saving, setSaving] = useState(false);
  const lastEditRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync with outside changes (another device, a real order) —
  // but not while staff are tapping this row themselves.
  useEffect(() => {
    if (Date.now() - lastEditRef.current > 1500) setValue(product.stock);
  }, [product.stock]);

  const commit = (next: number) => {
    const clamped = Math.max(0, Math.floor(next));
    lastEditRef.current = Date.now();
    setValue(clamped);
    if (timerRef.current) clearTimeout(timerRef.current);
    setSaving(true);
    timerRef.current = setTimeout(async () => {
      const ok = await updateProductStock(product.id, clamped);
      setSaving(false);
      if (ok) onSaved(product.id, clamped);
    }, 350);
  };

  const btn =
    "flex h-9 w-9 items-center justify-center font-mono text-base font-bold text-ink transition hover:bg-gold-tint active:scale-90";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center overflow-hidden rounded-full border-2 border-ink bg-paper">
        <button onClick={() => commit(value - 1)} aria-label={`One fewer ${product.name}`} className={btn}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          value={value}
          onChange={(e) => commit(Number(e.target.value))}
          aria-label={`${product.name} in stock`}
          className="w-12 border-x-2 border-ink bg-paper py-1.5 text-center font-mono text-sm font-bold text-ink outline-none"
        />
        <button onClick={() => commit(value + 1)} aria-label={`One more ${product.name}`} className={btn}>
          +
        </button>
      </div>
      <span className={`font-mono text-[0.62rem] text-ink-soft transition-opacity ${saving ? "opacity-100" : "opacity-0"}`}>saving…</span>
    </div>
  );
}

type Filter = "all" | "low" | "out" | "hidden";
const ROW_PAGE = 60;
type ModalState = { mode: "create" } | { mode: "edit"; product: Product } | null;

function StockBadge({ p }: { p: Product }) {
  if (p.stock_unknown)
    return (
      <span
        title="Clover has no count for this item, so the website shows it as available"
        className="rounded-full bg-green-tint px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-green-deep"
      >
        Not counted · on sale
      </span>
    );
  if (p.stock === 0)
    return <span className="rounded-full bg-ink px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-white">Sold out</span>;
  if (p.stock <= 3)
    return <span className="rounded-full bg-pink-tint px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-pink-deep">Low</span>;
  return null;
}

export default function InventoryPanel({
  products,
  categories,
  onStockSaved,
  onProductSaved,
  onProductRemoved,
  onRefresh,
  salesVelocity,
  initialSearch = "",
  isOwner = false,
}: {
  products: Product[];
  categories: Category[];
  onStockSaved: (id: string, stock: number) => void;
  onProductSaved: (product: Product) => void;
  onProductRemoved: (id: string) => void;
  onRefresh: () => void;
  salesVelocity: Record<string, number>;
  initialSearch?: string;
  isOwner?: boolean;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [filter, setFilter] = useState<Filter>("all");
  const [category, setCategory] = useState("All");
  const [showAll, setShowAll] = useState(false);
  const [rowLimit, setRowLimit] = useState(ROW_PAGE);
  const [modal, setModal] = useState<ModalState>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      low: products.filter((p) => p.stock > 0 && p.stock <= 3).length,
      out: products.filter((p) => p.stock === 0 && !p.stock_unknown).length,
      hidden: products.filter((p) => p.hide_online).length,
    }),
    [products]
  );

  const matching = useMemo(() => {
    let list = products;
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (filter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= 3);
    if (filter === "out") list = list.filter((p) => p.stock === 0 && !p.stock_unknown);
    if (filter === "hidden") list = list.filter((p) => p.hide_online);
    // Same ranking as the website: exact matches first ("water" → waters, not watermelon).
    if (search.trim()) return rankProducts(list, search);
    return [...list].sort((a, b) => (filter === "low" ? a.stock - b.stock : 0) || a.name.localeCompare(b.name));
  }, [products, category, filter, search]);

  const narrowed = Boolean(search.trim()) || filter !== "all" || category !== "All";
  const listOpen = narrowed || showAll;
  const shown = matching.slice(0, rowLimit);
  const reset = () => setRowLimit(ROW_PAGE);

  const toggleHidden = async (p: Product) => {
    setBusy(p.id + "h");
    const ok = await setProductHiddenOnline(p.id, !p.hide_online);
    if (ok) onProductSaved({ ...p, hide_online: !p.hide_online });
    setBusy(null);
  };
  const toggleSpecial = async (p: Product) => {
    setBusy(p.id + "s");
    await setProductSpecial(p.id, !p.is_special);
    setBusy(null);
    onRefresh();
  };
  const toggleHealthy = async (p: Product) => {
    setBusy(p.id + "g");
    await setProductHealthy(p.id, !p.is_healthy);
    setBusy(null);
    onRefresh();
  };

  const chip = (key: Filter, label: string, n?: number) => (
    <button
      key={key}
      type="button"
      onClick={() => {
        setFilter(key);
        reset();
      }}
      className={`flex shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 py-1.5 font-body text-sm font-semibold transition ${
        filter === key ? "border-ink bg-ink text-white" : "border-line bg-paper text-ink hover:border-ink"
      }`}
    >
      {label}
      {n !== undefined && <span className={`font-mono text-xs ${filter === key ? "text-gold" : "text-ink-soft"}`}>{n.toLocaleString()}</span>}
    </button>
  );

  return (
    <div>
      {/* Search + filters */}
      <div className="rounded-2xl border-2 border-ink bg-paper p-3 sm:p-4">
        <div className="flex gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search products</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-ink-soft" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                reset();
              }}
              placeholder={`Search ${products.length.toLocaleString()} products…`}
              className="w-full rounded-full border-2 border-ink bg-panel py-3 pl-11 pr-4 font-body text-base text-ink outline-none focus:bg-paper focus:ring-2 focus:ring-green"
            />
          </label>
          {isOwner && (
            <button
              onClick={() => setModal({ mode: "create" })}
              className="shrink-0 rounded-full border-2 border-ink bg-green px-4 font-mono text-xs font-bold uppercase tracking-wide text-white transition hover:bg-green-deep"
            >
              <span className="sm:hidden">+ Add</span>
              <span className="hidden sm:inline">+ Add product</span>
            </button>
          )}
        </div>
        <div className="-mx-1 mt-3 flex items-center gap-2 overflow-x-auto px-1 pb-1">
          {chip("all", "All")}
          {chip("low", "Low stock", counts.low)}
          {chip("out", "Sold out", counts.out)}
          {chip("hidden", "Hidden online", counts.hidden)}
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              reset();
            }}
            aria-label="Category"
            className={`ml-auto shrink-0 rounded-full border-2 px-3 py-1.5 font-body text-sm font-semibold outline-none ${
              category !== "All" ? "border-ink bg-gold text-gold-ink" : "border-line bg-paper text-ink"
            }`}
          >
            <option value="All">All categories</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
                {!c.showOnStorefront ? " (hidden online)" : ""}
              </option>
            ))}
          </select>
        </div>
      </div>

      {!listOpen ? (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line px-4 py-10 text-center">
          <p className="font-body text-sm text-ink-soft">Search above, or tap a filter, to find what you need.</p>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="rounded-full border-2 border-ink px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-ink hover:bg-gold"
          >
            Show all {products.length.toLocaleString()} products
          </button>
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center justify-between px-1">
            <p className="font-mono text-[0.65rem] font-bold uppercase tracking-widest text-ink-soft">
              {matching.length.toLocaleString()} product{matching.length === 1 ? "" : "s"}
              {search.trim() ? ` for “${search.trim()}”` : ""}
            </p>
            {(narrowed || showAll) && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                  setCategory("All");
                  setShowAll(false);
                  reset();
                }}
                className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-green hover:underline"
              >
                Clear
              </button>
            )}
          </div>

          <ul className="mt-2 flex flex-col gap-2">
            {shown.map((p) => {
              const velocity = salesVelocity[p.id] ?? 0;
              const daysLeft = velocity > 0 && p.stock > 0 ? p.stock / velocity : null;
              const urgent = daysLeft !== null && daysLeft <= 5;
              return (
                <li
                  key={p.id}
                  className={`flex gap-3 rounded-2xl border bg-paper p-3 transition sm:items-center ${
                    p.hide_online ? "border-dashed border-ink-soft/60 bg-panel" : "border-line hover:border-ink"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "edit", product: p })}
                    aria-label={`Edit ${p.name}`}
                    className="h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-white sm:h-16 sm:w-16"
                  >
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.image_url} alt="" className="h-full w-full object-contain p-1" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center font-poster text-xl uppercase text-white/90" style={{ backgroundColor: p.swatch }}>
                        {p.name.slice(0, 2)}
                      </span>
                    )}
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-body text-[0.95rem] font-semibold leading-snug text-ink">{p.name}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 font-body text-xs text-ink-soft">
                        <span className="font-mono font-bold text-ink">${p.price.toFixed(2)}</span>
                        <span>· {p.category}</span>
                        <StockBadge p={p} />
                        {p.hide_online && (
                          <span className="rounded-full border border-ink px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-ink">
                            Hidden online
                          </span>
                        )}
                        {p.is_special && (
                          <span className="rounded-full bg-gold px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-gold-ink">Special</span>
                        )}
                        {p.is_healthy && (
                          <span className="rounded-full bg-green-tint px-2 py-0.5 font-mono text-[0.6rem] font-bold uppercase tracking-wide text-green-deep">Healthy</span>
                        )}
                      </p>
                      {urgent && (
                        <p className="mt-1 font-mono text-[0.62rem] text-pink-deep">
                          Selling ~{velocity.toFixed(1)}/day — about {Math.max(1, Math.round(daysLeft!))} day{Math.round(daysLeft!) === 1 ? "" : "s"} left
                        </p>
                      )}
                    </div>

                    <StockStepper product={p} onSaved={onStockSaved} />

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 sm:w-[11.5rem] sm:justify-end">
                      <button
                        type="button"
                        onClick={() => toggleHidden(p)}
                        disabled={busy === p.id + "h"}
                        className={`rounded-full border-2 px-3 py-1 font-mono text-[0.65rem] font-bold uppercase tracking-wide transition disabled:opacity-60 ${
                          p.hide_online ? "border-green bg-green text-white hover:bg-green-deep" : "border-line text-ink-soft hover:border-ink hover:text-ink"
                        }`}
                      >
                        {p.hide_online ? "Show online" : "Hide online"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "edit", product: p })}
                        className="font-mono text-[0.65rem] font-bold uppercase tracking-wide text-green hover:underline"
                      >
                        Edit
                      </button>
                      {isOwner && (
                        <>
                          <button
                            type="button"
                            onClick={() => toggleSpecial(p)}
                            disabled={busy === p.id + "s"}
                            className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-gold-ink disabled:opacity-60"
                          >
                            {p.is_special ? "Unset special" : "Special"}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHealthy(p)}
                            disabled={busy === p.id + "g"}
                            className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-green disabled:opacity-60"
                          >
                            {p.is_healthy ? "Unset healthy" : "Healthy"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
            {shown.length === 0 && (
              <li className="rounded-2xl border-2 border-dashed border-line px-4 py-8 text-center font-body text-sm text-ink-soft">
                No products match{search.trim() ? ` “${search.trim()}”` : ""}.
              </li>
            )}
          </ul>

          {matching.length > shown.length && (
            <div className="mt-4 flex flex-col items-center gap-1.5">
              <button
                type="button"
                onClick={() => setRowLimit((n) => n + ROW_PAGE * 2)}
                className="rounded-full border-2 border-ink px-5 py-2 font-mono text-xs font-bold uppercase tracking-wide text-ink transition hover:bg-gold"
              >
                Show more
              </button>
              <p className="font-mono text-[0.65rem] text-ink-soft">
                Showing {shown.length} of {matching.length.toLocaleString()}
              </p>
            </div>
          )}
        </>
      )}

      {modal && (
        <ProductFormModal
          mode={modal.mode}
          product={modal.mode === "edit" ? modal.product : undefined}
          categories={categories}
          onClose={() => setModal(null)}
          onSaved={onProductSaved}
          onDeleted={onProductRemoved}
          onCategoryCreated={onRefresh}
        />
      )}
    </div>
  );
}
