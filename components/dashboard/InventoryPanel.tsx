"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { categories, updateProductStock, setProductSpecial, setProductHealthy, Product } from "@/lib/products";
import ProductFormModal from "./ProductFormModal";
import CloverPanel from "./CloverPanel";

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

type ModalState = { mode: "create" } | { mode: "edit"; product: Product } | null;

export default function InventoryPanel({
  products,
  onStockSaved,
  onProductSaved,
  onProductRemoved,
  onRefresh,
  salesVelocity,
}: {
  products: Product[];
  onStockSaved: (id: string, stock: number) => void;
  onProductSaved: (product: Product) => void;
  onProductRemoved: (id: string) => void;
  onRefresh: () => void;
  salesVelocity: Record<string, number>;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number] | "All">("All");
  const [sort, setSort] = useState<SortMode>("low-stock");
  const [modal, setModal] = useState<ModalState>(null);
  const [togglingSpecial, setTogglingSpecial] = useState<string | null>(null);
  const [togglingHealthy, setTogglingHealthy] = useState<string | null>(null);
  const [generatingPhotos, setGeneratingPhotos] = useState(false);
  const [photoResult, setPhotoResult] = useState<string | null>(null);
  const [generatingGalleryPhotos, setGeneratingGalleryPhotos] = useState(false);
  const [galleryPhotoResult, setGalleryPhotoResult] = useState<string | null>(null);

  const missingPhotoCount = useMemo(() => products.filter((p) => !p.image_url).length, [products]);

  // One-off sweep over every product currently missing a photo — including
  // ones Clover sync never touches at all (a product never linked to
  // Clover, like an old sample item, or one added by hand). Separate from
  // the automatic per-item generation Clover sync/webhook already do; see
  // app/api/products/generate-missing-photos/route.ts.
  const handleGenerateMissingPhotos = async () => {
    setGeneratingPhotos(true);
    setPhotoResult(null);
    try {
      const res = await fetch("/api/products/generate-missing-photos", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        if (body.eligible === 0) {
          setPhotoResult("Every product already has a photo.");
        } else {
          let message = `${body.generated} of ${body.eligible} photo${body.eligible === 1 ? "" : "s"} generated`;
          if (body.failed > 0) message += `, ${body.failed} failed — check Vercel's function logs for why`;
          message += ".";
          setPhotoResult(message);
        }
        onRefresh();
      } else {
        setPhotoResult(body.error || "Couldn't generate photos.");
      }
    } catch {
      setPhotoResult("Couldn't generate photos — check your connection.");
    }
    setGeneratingPhotos(false);
  };

  // Same idea, for the public Gallery page's six scene tiles instead of
  // products — see app/api/gallery/generate-photos/route.ts. These are
  // deliberately generic placeholder scenes, not real photos of the
  // actual store; swap in real ones before launch.
  const handleGenerateGalleryPhotos = async () => {
    setGeneratingGalleryPhotos(true);
    setGalleryPhotoResult(null);
    try {
      const res = await fetch("/api/gallery/generate-photos", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        if (body.eligible === 0) {
          setGalleryPhotoResult("Every gallery tile already has a photo.");
        } else {
          let message = `${body.generated} of ${body.eligible} gallery photo${body.eligible === 1 ? "" : "s"} generated`;
          if (body.failed > 0) message += `, ${body.failed} failed — check Vercel's function logs for why`;
          message += ".";
          setGalleryPhotoResult(message);
        }
      } else {
        setGalleryPhotoResult(body.error || "Couldn't generate gallery photos.");
      }
    } catch {
      setGalleryPhotoResult("Couldn't generate gallery photos — check your connection.");
    }
    setGeneratingGalleryPhotos(false);
  };

  const handleToggleSpecial = async (product: Product) => {
    setTogglingSpecial(product.id);
    await setProductSpecial(product.id, !product.is_special);
    setTogglingSpecial(null);
    onRefresh();
  };

  const handleToggleHealthy = async (product: Product) => {
    setTogglingHealthy(product.id);
    await setProductHealthy(product.id, !product.is_healthy);
    setTogglingHealthy(null);
    onRefresh();
  };

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
      <CloverPanel onSynced={onRefresh} />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-4">
        <div>
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">AI Photos</p>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Fill in missing pictures with an AI-generated placeholder.
          </p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {missingPhotoCount > 0 && (
            <button
              onClick={handleGenerateMissingPhotos}
              disabled={generatingPhotos}
              className="rounded-full border border-line bg-paper px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-gold-ink hover:text-gold-ink disabled:opacity-60"
            >
              {generatingPhotos
                ? "Generating…"
                : `✦ Generate ${missingPhotoCount} missing product photo${missingPhotoCount === 1 ? "" : "s"}`}
            </button>
          )}
          <button
            onClick={handleGenerateGalleryPhotos}
            disabled={generatingGalleryPhotos}
            className="rounded-full border border-line bg-paper px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-gold-ink hover:text-gold-ink disabled:opacity-60"
          >
            {generatingGalleryPhotos ? "Generating…" : "✦ Generate gallery photos"}
          </button>
        </div>
        {(photoResult || galleryPhotoResult) && (
          <div className="w-full font-body text-xs text-ink-soft">
            {photoResult && <p>{photoResult}</p>}
            {galleryPhotoResult && <p>{galleryPhotoResult}</p>}
          </div>
        )}
      </div>

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
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-1.5">
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
          <button
            onClick={() => setModal({ mode: "create" })}
            className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep"
          >
            + Add Product
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[720px] border-collapse font-body text-sm">
          <thead>
            <tr className="border-b border-line bg-panel text-left">
              <th className="px-4 py-2.5"></th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Product</th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Category</th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Price</th>
              <th className="px-4 py-2.5 font-mono text-[0.68rem] uppercase tracking-wide text-ink-soft">Stock</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const outOfStock = p.stock === 0;
              const lowStock = p.stock > 0 && p.stock <= 3;
              const velocity = salesVelocity[p.id] ?? 0;
              const daysLeft = velocity > 0 ? p.stock / velocity : null;
              const urgentPace = !outOfStock && daysLeft !== null && daysLeft <= 5;
              return (
                <tr key={p.id} className="border-b border-line last:border-none">
                  <td className="px-4 py-2.5">
                    <button
                      type="button"
                      onClick={() => setModal({ mode: "edit", product: p })}
                      aria-label={`Edit ${p.name}`}
                      className="block shrink-0 rounded transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-green"
                    >
                      {p.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.image_url}
                          alt=""
                          className="h-16 w-16 rounded object-cover sm:h-14 sm:w-14"
                        />
                      ) : (
                        <div
                          className="h-16 w-16 rounded sm:h-14 sm:w-14"
                          style={{ backgroundColor: p.swatch }}
                        />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {p.name}
                    {p.is_special && (
                      <span className="ml-2 rounded-full bg-gold-tint px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-gold-ink">
                        Special
                      </span>
                    )}
                    {p.is_healthy && (
                      <span className="ml-2 rounded-full bg-green-tint px-2 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-green-deep">
                        Healthy Pick
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{p.category}</td>
                  <td className="px-4 py-2.5 font-mono text-ink-soft">${p.price.toFixed(2)}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-1.5">
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
                      {urgentPace && (
                        <span className="font-mono text-[0.62rem] text-[#a8461a]">
                          Selling ~{velocity.toFixed(1)}/day — ~{Math.max(1, Math.round(daysLeft!))}d left at this pace
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-col items-end gap-1.5">
                      <button
                        onClick={() => setModal({ mode: "edit", product: p })}
                        className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-green"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleSpecial(p)}
                        disabled={togglingSpecial === p.id}
                        className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-gold-ink disabled:opacity-60"
                      >
                        {p.is_special ? "Unset Special" : "Make Special"}
                      </button>
                      <button
                        onClick={() => handleToggleHealthy(p)}
                        disabled={togglingHealthy === p.id}
                        className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-green disabled:opacity-60"
                      >
                        {p.is_healthy ? "Unset Healthy Pick" : "Mark Healthy Pick"}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-6 text-center font-body text-sm text-ink-soft">
                  No products match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <ProductFormModal
          mode={modal.mode}
          product={modal.mode === "edit" ? modal.product : undefined}
          onClose={() => setModal(null)}
          onSaved={onProductSaved}
          onDeleted={onProductRemoved}
        />
      )}
    </div>
  );
}
