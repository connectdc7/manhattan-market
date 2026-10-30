"use client";

import { useMemo, useState } from "react";
import type { Product } from "@/lib/products";
import type { Category } from "@/lib/categories";
import { staffFetch } from "@/lib/staff-auth";
import CloverPanel from "./CloverPanel";
import CategoryReviewPanel from "./CategoryReviewPanel";
import CategoryManagerPanel from "./CategoryManagerPanel";

// Owner-only "Store setup": the once-in-a-while tools that used to sit on
// top of the product list — Clover connection & sync, which departments
// show on the website, and product photos.

function ProductPhotosCard({ products, onRefresh }: { products: Product[]; onRefresh: () => void }) {
  const [generating, setGenerating] = useState(false);
  const [photoResult, setPhotoResult] = useState<string | null>(null);
  const [finding, setFinding] = useState(false);
  const [findResult, setFindResult] = useState<string | null>(null);
  const missing = useMemo(() => products.filter((p) => !p.image_url).length, [products]);

  // One-off sweep over every product missing a photo — see
  // app/api/products/generate-missing-photos/route.ts.
  const generate = async () => {
    setGenerating(true);
    setPhotoResult(null);
    try {
      const res = await staffFetch("/api/products/generate-missing-photos", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        if (body.eligible === 0) setPhotoResult("Every product already has a photo.");
        else {
          let message = `${body.generated} of ${body.eligible} photo${body.eligible === 1 ? "" : "s"} generated`;
          if (body.failed > 0) message += `, ${body.failed} failed — check Vercel's function logs for why`;
          setPhotoResult(message + ".");
        }
        onRefresh();
      } else setPhotoResult(body.error || "Couldn't generate photos.");
    } catch {
      setPhotoResult("Couldn't generate photos — check your connection.");
    }
    setGenerating(false);
  };

  // Free real package photos by barcode (Open Food Facts) — see
  // app/api/products/find-photos and lib/photo-lookup.ts.
  const find = async () => {
    setFinding(true);
    setFindResult("Looking up photos by barcode — this can take a few minutes…");
    try {
      const res = await staffFetch("/api/products/find-photos", { method: "POST" });
      const body = await res.json();
      if (res.ok) {
        setFindResult(
          `Checked ${body.checked} item${body.checked === 1 ? "" : "s"}, found ${body.found} photo${body.found === 1 ? "" : "s"}.` +
            (body.remaining > 0
              ? ` ${body.remaining} still to check — click again to continue (it also keeps going on its own in the background).`
              : " All items with a barcode have been checked.")
        );
        onRefresh();
      } else setFindResult(body.error || "Couldn't look up photos.");
    } catch {
      setFindResult("Couldn't look up photos — check your connection.");
    }
    setFinding(false);
  };

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-panel p-4">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Product Photos</p>
        <p className="mt-1 font-body text-sm text-ink-soft">
          {missing > 0
            ? `${missing.toLocaleString()} items have no photo yet. Real package photos are found free by barcode; tap a product in Products to upload your own.`
            : "Every product has a photo."}
        </p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        {missing > 0 && (
          <button
            onClick={find}
            disabled={finding}
            className="rounded-full bg-green px-3.5 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
          >
            {finding ? "Finding photos…" : "Find product photos (free)"}
          </button>
        )}
        {/* AI generation costs money per image — only offered once the
            missing list is small enough to be deliberate about. */}
        {missing > 0 && missing <= 25 && (
          <button
            onClick={generate}
            disabled={generating}
            className="rounded-full border border-line bg-paper px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-gold-ink hover:text-gold-ink disabled:opacity-60"
          >
            {generating ? "Generating…" : `✦ Generate ${missing} missing product photo${missing === 1 ? "" : "s"}`}
          </button>
        )}
      </div>
      {(photoResult || findResult) && (
        <div className="w-full font-body text-xs text-ink-soft">
          {findResult && <p>{findResult}</p>}
          {photoResult && <p>{photoResult}</p>}
        </div>
      )}
    </div>
  );
}

export default function StoreSetupPanel({
  products,
  categories,
  onRefresh,
}: {
  products: Product[];
  categories: Category[];
  onRefresh: () => void;
}) {
  const hiddenAlcohol = categories.filter((c) => c.ageRestricted && !c.showOnStorefront).map((c) => c.name);
  return (
    <div>
      {hiddenAlcohol.length > 0 && (
        <p className="mb-4 rounded-xl border-2 border-ink bg-gold-tint px-4 py-3 font-body text-sm text-ink">
          <span className="font-semibold">{hiddenAlcohol.join(" & ")}</span> {hiddenAlcohol.length === 1 ? "is" : "are"} hidden from the website
          for now. To sell {hiddenAlcohol.length === 1 ? "it" : "them"} online again, turn {hiddenAlcohol.length === 1 ? "it" : "them"} back on in{" "}
          <span className="font-semibold">Manage categories</span> below.
        </p>
      )}
      <CloverPanel onSynced={onRefresh} />
      <CategoryReviewPanel categories={categories} onResolved={onRefresh} />
      <CategoryManagerPanel categories={categories} products={products} onChanged={onRefresh} />
      <ProductPhotosCard products={products} onRefresh={onRefresh} />
    </div>
  );
}
