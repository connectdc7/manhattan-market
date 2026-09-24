"use client";

import { useState } from "react";
import { Category, confirmCategory, mergeCategoryInto, renameCategory } from "@/lib/categories";

const MERGE_NONE = "__keep_separate__";

function ReviewRow({
  category,
  otherCategories,
  onResolved,
}: {
  category: Category;
  otherCategories: Category[];
  onResolved: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [showOnStorefront, setShowOnStorefront] = useState(false);
  const [mergeInto, setMergeInto] = useState(MERGE_NONE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    if (mergeInto !== MERGE_NONE) {
      const ok = await mergeCategoryInto(category.name, mergeInto);
      setSaving(false);
      if (ok) onResolved();
      else setError("Couldn't merge that category — try again.");
      return;
    }

    const trimmed = name.trim();
    if (!trimmed) {
      setSaving(false);
      setError("Give it a name, or pick a category to merge into.");
      return;
    }

    let finalName = category.name;
    if (trimmed !== category.name) {
      const renamed = await renameCategory(category.name, trimmed);
      if (!renamed) {
        setSaving(false);
        setError("Couldn't rename that category — try again.");
        return;
      }
      finalName = trimmed;
    }

    const confirmed = await confirmCategory(finalName, showOnStorefront);
    setSaving(false);
    if (confirmed) onResolved();
    else setError("Couldn't save that category — try again.");
  };

  return (
    <div className="rounded-lg border border-line bg-paper p-3">
      <p className="font-body text-sm text-ink">
        New from Clover: <span className="font-semibold">{category.name}</span>
      </p>

      <div className="mt-2.5 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">Keep as</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={mergeInto !== MERGE_NONE}
            className="w-40 rounded border border-line bg-panel px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-green disabled:opacity-50"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">Or merge into</span>
          <select
            value={mergeInto}
            onChange={(e) => setMergeInto(e.target.value)}
            className="w-44 rounded border border-line bg-panel px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
          >
            <option value={MERGE_NONE}>— keep separate —</option>
            {otherCategories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-1.5 pb-1.5">
          <input
            type="checkbox"
            checked={showOnStorefront}
            onChange={(e) => setShowOnStorefront(e.target.checked)}
            disabled={mergeInto !== MERGE_NONE}
            className="disabled:opacity-50"
          />
          <span className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft">
            Show on storefront
          </span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>

      {!showOnStorefront && mergeInto === MERGE_NONE && (
        <p className="mt-1.5 font-body text-xs text-ink-soft">
          Stays off the online order page until you check &quot;Show on storefront&quot; — items in
          it are still tracked in inventory either way.
        </p>
      )}
      {error && <p className="mt-1.5 font-body text-xs text-[#a8461a]">{error}</p>}
    </div>
  );
}

// Shown on the dashboard's Inventory tab whenever a Clover sync has
// introduced a department name that isn't one of the categories staff
// already know about (see lib/clover.ts's resolveCloverCategory). Products
// in a new category sync in immediately and correctly either way — this is
// just where staff decide, once, what to call it and whether it belongs on
// the public order page (a "Lottery" or "Tobacco" department from Clover
// probably shouldn't).
export default function CategoryReviewPanel({
  categories,
  onResolved,
}: {
  categories: Category[];
  onResolved: () => void;
}) {
  const pending = categories.filter((c) => c.needsReview);
  if (pending.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-gold-ink/40 bg-gold-tint p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-wide text-gold-ink">
        {pending.length} categor{pending.length === 1 ? "y" : "ies"} from Clover need a quick look
      </p>
      <p className="mt-1 font-body text-sm text-ink-soft">
        Rename to match your existing naming, merge into a category you already have, or confirm
        as-is — and choose whether it should show on the online order page.
      </p>
      <div className="mt-3 flex flex-col gap-2.5">
        {pending.map((c) => (
          <ReviewRow
            key={c.name}
            category={c}
            otherCategories={categories.filter((other) => other.name !== c.name)}
            onResolved={onResolved}
          />
        ))}
      </div>
    </div>
  );
}
