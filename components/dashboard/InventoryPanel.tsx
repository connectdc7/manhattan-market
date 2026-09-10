"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categories, updateProductStock, Product } from "@/lib/products";

function StockStepper({
  product,
  onSaved,
}: {
  product: Product;
  onSaved: (id: string, stock: number) => void;
}) {
  const [value, setValue] = useState(product.stock);
  const [saving, setSaving] = useState(false);
  const lastEditRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Stay in sync with external changes (another tab, a real order coming
  // in) — but not while the user just touched this row themselves.
  useEffect(() => {
    if (Date.now() - lastEditRef.current > 1500) {
      setValue(product.stock);
    }
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

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => commit(value - 1)}
        aria-label="Decrease stock"
        className="flex h-7 w-7 items-center justify-center rounded border border-line font-mono text-sm text-ink hover:border-green hover:text-green"
      >
        −
      </button>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => commit(Number(e.target.value))}
        className="w-16 rounded border border-line bg-paper px-2 py-1 text-center font-mono text-sm text-ink outline-none focus:border-green"
      />
      <button
        onClick={() => commit(value + 1)}
        aria-label="Increase stock"
        className="flex h-7 w-7 items-center justify-center rounded border border-line font-mono text-sm text-ink hover:border-green hover:text-green"
      >
        +
      </button>
      <span className={`w-10 font-mono text-[0.62rem] text-ink-soft transition-opacity ${saving ? "opacity-100" : "opacity-0"}`}>
        saving…
      </span>
    </div>
  );
}

type SortMode = "low-stock" | "name";

export default function InventoryPanel({
  products,
  onStockSaved,
}: {
  products: Product[];
  onStockSaved: (id: string, stock: number) => void;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number] | "All">("All");
  const [sort, setSort] = useState<SortMode>("low-stock");

  const shown = useMemo(() => {
    let list = products;
    if (category !== "All") list = list.filter((p) => p.category === category);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q));
    }
    list = [...list];
    if (sort === "low-stock") {
      list.sort((a, b) => a.stock - b.stock);
    } else {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [products, category, search, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="rounded-full border border-line bg-paper px-4 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
        />
        {(["All", ...categories] as const).map((c) => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`rounded-full border px-3.5 py-1.5 font-mono text-xs font-semibold transition ${
              category === c
                ? "border-green bg-green text-white"
                : "border-line text-ink-soft hover:border-green hover:text-green"
            }`}
          >
            {c}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5">
          <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Sort</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded border border-line bg-paper px-2 py-1 font-mono text-xs text-ink outline-none focus:border-green"
          >
            <option value="low-stock">Low stock first</option>
            <option value="name">Name (A–Z)</option>
          </select>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[620px] border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left">
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Product</th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Category</th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Price</th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Stock</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const outOfStock = p.stock === 0;
              const lowStock = p.stock > 0 && p.stock <= 3;
              return (
                <tr key={p.id} className="border-b border-line last:border-none">
                  <td className="px-4 py-2.5 text-ink">{p.name}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{p.category}</td>
                  <td className="px-4 py-2.5 font-mono text-ink-soft">${p.price.toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StockStepper product={p} onSaved={onStockSaved} />
                      {outOfStock && (
                        <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-wide text-[#a8461a]">
                          Out
                        </span>
                      )}
                      {lowStock && (
                        <span className="font-mono text-[0.62rem] font-semibold uppercase tracking-wide text-[#a8461a]">
                          Low
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center font-body text-sm text-ink-soft">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
