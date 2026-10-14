"use client";

import { useEffect, useRef, useState } from "react";
import {
  deleteGalleryPhoto,
  GalleryPhoto,
  getGalleryPhotos,
  updateGalleryPhoto,
  uploadGalleryPhoto,
} from "@/lib/gallery";

// Dashboard → Gallery tab. Upload any number of photos at once (pick
// several from the phone's camera roll or the Mac's Photos/Finder), add an
// optional caption, reorder, delete. Changes show on the public Gallery
// page right away — there's no separate Save step.

function CaptionInput({ photo, onSaved }: { photo: GalleryPhoto; onSaved: () => void }) {
  const [value, setValue] = useState(photo.caption);
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");

  const save = async () => {
    if (value.trim() === photo.caption) return;
    setState("saving");
    const ok = await updateGalleryPhoto(photo.id, { caption: value.trim().slice(0, 120) });
    setState(ok ? "saved" : "idle");
    if (ok) {
      onSaved();
      setTimeout(() => setState("idle"), 1500);
    }
  };

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        placeholder="Add a caption (optional)"
        maxLength={120}
        className="w-full rounded border border-line bg-paper px-2.5 py-1.5 font-body text-xs text-ink outline-none focus:border-green"
      />
      {state !== "idle" && (
        <span className="absolute right-2 top-1/2 -translate-y-1/2 font-mono text-[0.55rem] uppercase text-green">
          {state === "saving" ? "Saving…" : "Saved"}
        </span>
      )}
    </div>
  );
}

export default function GalleryPanel() {
  const [photos, setPhotos] = useState<GalleryPhoto[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number; failed: number } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = async () => setPhotos(await getGalleryPhotos());
  useEffect(() => {
    let cancelled = false;
    getGalleryPhotos().then((p) => {
      if (!cancelled) setPhotos(p);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    e.target.value = "";
    if (files.length === 0) return;
    setMessage(null);
    const start = (photos ?? []).reduce((m, p) => Math.max(m, p.sortOrder), 0) + 1;
    let failed = 0;
    setProgress({ done: 0, total: files.length, failed: 0 });
    // A few at a time — fast, without overwhelming a phone's connection.
    let next = 0;
    const worker = async () => {
      while (next < files.length) {
        const i = next++;
        const ok = await uploadGalleryPhoto(files[i], start + i);
        if (!ok) failed++;
        setProgress((p) => (p ? { ...p, done: p.done + 1, failed } : p));
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    setProgress(null);
    setMessage(
      failed === 0
        ? `Added ${files.length} photo${files.length === 1 ? "" : "s"} to the Gallery.`
        : `Added ${files.length - failed} of ${files.length}. ${failed} couldn't upload — try those again.`
    );
    load();
  };

  const move = async (index: number, dir: -1 | 1) => {
    if (!photos) return;
    const other = index + dir;
    if (other < 0 || other >= photos.length) return;
    const a = photos[index];
    const b = photos[other];
    // Swap positions (renumber everything first so ties can't get stuck).
    const reordered = [...photos];
    reordered[index] = b;
    reordered[other] = a;
    setPhotos(reordered.map((p, i) => ({ ...p, sortOrder: i + 1 })));
    setBusyId(a.id);
    await Promise.all(reordered.map((p, i) => (p.sortOrder !== i + 1 ? updateGalleryPhoto(p.id, { sort_order: i + 1 }) : true)));
    setBusyId(null);
  };

  const remove = async (photo: GalleryPhoto) => {
    if (confirmDelete !== photo.id) {
      setConfirmDelete(photo.id);
      return;
    }
    setBusyId(photo.id);
    const ok = await deleteGalleryPhoto(photo);
    setBusyId(null);
    setConfirmDelete(null);
    if (!ok) setMessage("Couldn't delete that photo — try again.");
    load();
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-lg border border-line bg-panel p-4">
        <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">Gallery photos</p>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Add as many photos as you like — select several at once from your phone or computer. They show on the
          website&apos;s Gallery page right away, in the order below.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={Boolean(progress)}
            className="rounded-full bg-green px-4 py-2 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-60"
          >
            {progress ? `Uploading ${progress.done} of ${progress.total}…` : "+ Add photos"}
          </button>
          <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
          {message && <p className="font-body text-xs text-ink-soft">{message}</p>}
        </div>
      </div>

      {photos === null ? (
        <p className="font-mono text-xs uppercase tracking-wide text-ink-soft">Loading…</p>
      ) : photos.length === 0 ? (
        <p className="font-body text-sm text-ink-soft">
          No photos yet — the Gallery page shows placeholder tiles until you add some.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((p, i) => (
            <div key={p.id} className={`overflow-hidden rounded-lg border border-line bg-paper ${busyId === p.id ? "opacity-60" : ""}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || "Gallery photo"} className="h-44 w-full object-cover" />
              <div className="flex flex-col gap-2 p-3">
                <CaptionInput photo={p} onSaved={load} />
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      aria-label="Move earlier"
                      className="h-7 w-7 rounded border border-line font-mono text-xs text-ink-soft hover:border-green hover:text-green disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === photos.length - 1}
                      aria-label="Move later"
                      className="h-7 w-7 rounded border border-line font-mono text-xs text-ink-soft hover:border-green hover:text-green disabled:opacity-30"
                    >
                      →
                    </button>
                  </div>
                  <span className="font-mono text-[0.6rem] text-ink-soft">#{i + 1}</span>
                  <button
                    type="button"
                    onClick={() => remove(p)}
                    onBlur={() => setTimeout(() => setConfirmDelete((c) => (c === p.id ? null : c)), 200)}
                    className={`font-mono text-[0.65rem] uppercase tracking-wide ${
                      confirmDelete === p.id ? "font-semibold text-[#a8461a]" : "text-ink-soft hover:text-[#a8461a]"
                    }`}
                  >
                    {confirmDelete === p.id ? "Tap again to delete" : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
