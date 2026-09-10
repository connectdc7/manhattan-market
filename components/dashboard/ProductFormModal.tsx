"use client";

import { useEffect, useState } from "react";
import {
  categories,
  createProduct,
  deleteProduct,
  updateProduct,
  Product,
  ProductCategory,
} from "@/lib/products";

type Props = {
  mode: "create" | "edit";
  product?: Product;
  onClose: () => void;
  onSaved: (product: Product) => void;
  onDeleted?: (id: string) => void;
};

export default function ProductFormModal({ mode, product, onClose, onSaved, onDeleted }: Props) {
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState<ProductCategory>(product?.category ?? categories[0]);
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [stock, setStock] = useState("0");
  const [blurb, setBlurb] = useState(product?.blurb ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(product?.image_url || null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Auto-cancel the "are you sure" delete state if the staffer wanders off.
  useEffect(() => {
    if (!confirmDelete) return;
    const t = setTimeout(() => setConfirmDelete(false), 4000);
    return () => clearTimeout(t);
  }, [confirmDelete]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    setRemovePhoto(false);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const handleRemovePhoto = () => {
    setPhotoFile(null);
    setRemovePhoto(true);
    setPhotoPreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Give the product a name.");
      return;
    }
    const priceNum = Number(price);
    if (!Number.isFinite(priceNum) || priceNum < 0) {
      setError("Enter a valid price.");
      return;
    }

    setSaving(true);
    if (mode === "create") {
      const stockNum = Math.max(0, Math.floor(Number(stock) || 0));
      const created = await createProduct({
        name: name.trim(),
        category,
        price: priceNum,
        stock: stockNum,
        blurb: blurb.trim(),
        photoFile,
      });
      setSaving(false);
      if (created) {
        onSaved(created);
        onClose();
      } else {
        setError("Couldn't add that product — try again.");
      }
    } else if (product) {
      const updated = await updateProduct(product.id, {
        name: name.trim(),
        category,
        price: priceNum,
        blurb: blurb.trim(),
        photoFile,
        removePhoto,
      });
      setSaving(false);
      if (updated) {
        onSaved(updated);
        onClose();
      } else {
        setError("Couldn't save those changes — try again.");
      }
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (!product) return;
    setSaving(true);
    setError(null);
    const ok = await deleteProduct(product.id);
    setSaving(false);
    if (ok) {
      onDeleted?.(product.id);
      onClose();
    } else {
      setError("Couldn't remove that product — try again.");
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-50 bg-ink/40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg border border-line bg-paper p-6 shadow-xl">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-ink">
              {mode === "create" ? "Add Product" : "Edit Product"}
            </h2>
            <button onClick={onClose} className="font-mono text-xs text-ink-soft hover:text-ink">
              Close
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
            <div>
              <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Photo</p>
              <div className="mt-1.5 flex items-center gap-3">
                {photoPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoPreview}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded font-mono text-[0.55rem] uppercase text-white/70"
                    style={{ backgroundColor: product?.swatch ?? "#21594a" }}
                  >
                    no photo
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <label className="cursor-pointer rounded-full border border-line px-3 py-1.5 text-center font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green">
                    Choose Photo
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                  {photoPreview && (
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a]"
                    >
                      Remove photo
                    </button>
                  )}
                </div>
              </div>
            </div>

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Name</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green"
              />
            </label>

            <div className="flex gap-3">
              <label className="flex flex-1 flex-col gap-1">
                <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as ProductCategory)}
                  className="rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green"
                >
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex w-28 flex-col gap-1">
                <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Price</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  required
                  className="rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green"
                />
              </label>
            </div>

            {mode === "create" && (
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
                  Starting stock
                </span>
                <input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="w-28 rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green"
                />
              </label>
            )}

            <label className="flex flex-col gap-1">
              <span className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
                Description
              </span>
              <textarea
                value={blurb}
                onChange={(e) => setBlurb(e.target.value)}
                rows={2}
                placeholder="A short line shown under the product on the site"
                className="resize-none rounded border border-line bg-paper px-3 py-2 font-body text-sm text-ink outline-none focus:border-green"
              />
            </label>

            {error && <p className="font-body text-sm text-[#a8461a]">{error}</p>}

            <div className="mt-1 flex items-center justify-between">
              {mode === "edit" ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={saving}
                  className="font-mono text-xs font-semibold text-[#a8461a] hover:underline disabled:opacity-50"
                >
                  {confirmDelete ? "Click again to remove" : "Remove product"}
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="font-mono text-xs text-ink-soft hover:text-ink"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-green px-4 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
                >
                  {saving ? "Saving…" : mode === "create" ? "Add Product" : "Save Changes"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
