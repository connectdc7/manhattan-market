"use client";

import { useMemo, useState } from "react";
import { Category, mergeCategoryInto, renameCategory, setCategoryAisle, setCategoryVisibility } from "@/lib/categories";
import { AISLES, guessAisle } from "@/lib/aisles";
import { Product } from "@/lib/products";

// "Manage categories" on the dashboard's Inventory tab — every category
// that's already been reviewed, with a switch for whether it shows on the
// website, plus rename and merge. Categories still waiting for their first
// review live in CategoryReviewPanel above this instead.
//
// Hiding a category only takes it off the website; its items stay in
// inventory and keep syncing from Clover.

function ManageRow({
  category,
  count,
  others,
  onChanged,
}: {
  category: Category;
  count: number;
  others: Category[];
  onChanged: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "rename" | "merge">("idle");
  const [name, setName] = useState(category.name);
  const [mergeInto, setMergeInto] = useState("");
  const [confirmMerge, setConfirmMerge] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMode("idle");
    setName(category.name);
    setMergeInto("");
    setConfirmMerge(false);
    setError(null);
  };

  const toggleVisible = async () => {
    setBusy(true);
    setError(null);
    const ok = await setCategoryVisibility(category.name, !category.showOnStorefront);
    setBusy(false);
    if (ok) onChanged();
    else setError("Couldn't change that — try again.");
  };

  const changeAisle = async (value: string) => {
    setBusy(true);
    setError(null);
    const ok = await setCategoryAisle(category.name, value || null);
    setBusy(false);
    if (ok) onChanged();
    else setError("Couldn't move it — has supabase/category-aisles.sql been run?");
  };

  const saveRename = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) return reset();
    if (others.some((o) => o.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(`"${trimmed}" already exists — use Merge instead.`);
      return;
    }
    setBusy(true);
    const ok = await renameCategory(category.name, trimmed);
    setBusy(false);
    if (ok) onChanged();
    else setError("Couldn't rename it — try again.");
  };

  const doMerge = async () => {
    if (!mergeInto) return;
    if (!confirmMerge) {
      setConfirmMerge(true);
      return;
    }
    setBusy(true);
    const ok = await mergeCategoryInto(category.name, mergeInto);
    setBusy(false);
    if (ok) onChanged();
    else setError("Couldn't merge — try again.");
  };

  return (
    <div className="flex flex-col gap-2 border-b border-line py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center" title="Show this category on the website">
          <span
            role="switch"
            aria-checked={category.showOnStorefront}
            tabIndex={0}
            onClick={() => !busy && toggleVisible()}
            onKeyDown={(e) => {
              if ((e.key === " " || e.key === "Enter") && !busy) {
                e.preventDefault();
                toggleVisible();
              }
            }}
            aria-label={`Show ${category.name} on the website`}
            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full transition ${
              category.showOnStorefront ? "bg-green" : "bg-line"
            } ${busy ? "opacity-60" : ""}`}
          >
            <span
              className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
                category.showOnStorefront ? "left-[1.125rem]" : "left-0.5"
              }`}
            />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-body text-sm text-ink">{category.name}</p>
          <p className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">
            {count} item{count === 1 ? "" : "s"} · {category.showOnStorefront ? "On website" : "Hidden from website"}
          </p>
        </div>

        <select
          value={category.group ?? ""}
          onChange={(e) => changeAisle(e.target.value)}
          disabled={busy}
          aria-label={`Website aisle for ${category.name}`}
          title="Which aisle this shows under on the website"
          className="max-w-[12rem] rounded border border-line bg-paper px-2 py-1 font-body text-xs text-ink outline-none focus:border-green disabled:opacity-60"
        >
          <option value="">Auto: {guessAisle(category.name)}</option>
          {AISLES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>

        {mode === "idle" && (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setMode("rename")}
              className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-green"
            >
              Rename
            </button>
            {others.length > 0 && (
              <button
                type="button"
                onClick={() => setMode("merge")}
                className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-green"
              >
                Merge
              </button>
            )}
          </div>
        )}
      </div>

      {mode === "rename" && (
        <div className="flex flex-wrap items-center gap-2 pl-12">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && saveRename()}
            autoFocus
            className="w-48 rounded border border-line bg-paper px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
          />
          <button
            type="button"
            onClick={saveRename}
            disabled={busy}
            className="rounded-full bg-green px-3 py-1 font-mono text-xs font-semibold text-white hover:bg-green-deep disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={reset} className="font-mono text-xs text-ink-soft hover:text-ink">
            Cancel
          </button>
        </div>
      )}

      {mode === "merge" && (
        <div className="flex flex-wrap items-center gap-2 pl-12">
          <span className="font-body text-sm text-ink-soft">Move all {count} items into</span>
          <select
            value={mergeInto}
            onChange={(e) => {
              setMergeInto(e.target.value);
              setConfirmMerge(false);
            }}
            className="rounded border border-line bg-paper px-2 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
          >
            <option value="">Choose a category…</option>
            {others.map((o) => (
              <option key={o.name} value={o.name}>
                {o.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={doMerge}
            disabled={busy || !mergeInto}
            className={`rounded-full px-3 py-1 font-mono text-xs font-semibold text-white disabled:opacity-50 ${
              confirmMerge ? "bg-[#a8461a]" : "bg-green hover:bg-green-deep"
            }`}
          >
            {busy ? "Merging…" : confirmMerge ? `Yes, merge into ${mergeInto}` : "Merge"}
          </button>
          <button type="button" onClick={reset} className="font-mono text-xs text-ink-soft hover:text-ink">
            Cancel
          </button>
          {confirmMerge && (
            <p className="w-full font-body text-xs text-ink-soft">
              &ldquo;{category.name}&rdquo; will be removed and its items moved. Future Clover syncs will put
              them in {mergeInto} too.
            </p>
          )}
        </div>
      )}

      {error && <p className="pl-12 font-body text-xs text-[#a8461a]">{error}</p>}
    </div>
  );
}

export default function CategoryManagerPanel({
  categories,
  products,
  onChanged,
}: {
  categories: Category[];
  products: Product[];
  onChanged: () => void;
}) {
  const [filter, setFilter] = useState("");

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of products) m.set(p.category, (m.get(p.category) ?? 0) + 1);
    return m;
  }, [products]);

  const reviewed = useMemo(
    () => categories.filter((c) => !c.needsReview).sort((a, b) => a.name.localeCompare(b.name)),
    [categories]
  );
  const shownOnSite = reviewed.filter((c) => c.showOnStorefront).length;
  const q = filter.trim().toLowerCase();
  const visible = q ? reviewed.filter((c) => c.name.toLowerCase().includes(q)) : reviewed;

  if (reviewed.length === 0) return null;

  return (
    <details className="mb-4 rounded-lg border border-line bg-panel p-4">
      <summary className="cursor-pointer select-none font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
        Manage categories · {shownOnSite} of {reviewed.length} on the website
      </summary>
      <p className="mt-2 font-body text-sm text-ink-soft">
        Use the switch to show or hide a category on the website, and the dropdown to choose which aisle it appears
        under. Hidden items stay in inventory and keep syncing from Clover.
      </p>
      {reviewed.length > 8 && (
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Find a category…"
          className="mt-3 w-full max-w-xs rounded-full border border-line bg-paper px-4 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
        />
      )}
      <div className="mt-2">
        {visible.map((c) => (
          <ManageRow
            key={c.name + String(c.showOnStorefront) + (c.group ?? "")}
            category={c}
            count={counts.get(c.name) ?? 0}
            others={categories.filter((o) => o.name !== c.name)}
            onChanged={onChanged}
          />
        ))}
      </div>
    </details>
  );
}
