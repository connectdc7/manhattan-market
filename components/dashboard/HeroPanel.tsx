"use client";

import { useEffect, useRef, useState } from "react";
import {
  HERO_EFFECTS,
  HeroEffect,
  HeroMedia,
  deleteHeroMedia,
  setActiveHeroMedia,
  setHeroEffect,
  uploadHeroMedia,
} from "@/lib/hero";

const MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // matches the hero-media bucket's file_size_limit in seed.sql

function MediaThumb({
  media,
  onSetActive,
  onDelete,
  busy,
}: {
  media: HeroMedia;
  onSetActive: () => void;
  onDelete: () => void;
  busy: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-2 ${
        media.isActive ? "border-green bg-green-tint" : "border-line bg-paper"
      }`}
    >
      <div className="relative h-28 w-full overflow-hidden rounded">
        {media.kind === "video" ? (
          <video src={media.url} className="h-full w-full object-cover" muted playsInline />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={media.url} alt="" className="h-full w-full object-cover" />
        )}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 font-mono text-[0.55rem] uppercase tracking-wide text-white">
          {media.kind}
        </span>
      </div>
      <div className="flex items-center justify-between gap-2">
        {media.isActive ? (
          <span className="font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-green-deep">
            Live now
          </span>
        ) : (
          <button
            type="button"
            onClick={onSetActive}
            disabled={busy}
            className="rounded-full border border-line px-2.5 py-1 font-mono text-[0.6rem] font-semibold uppercase tracking-wide text-ink-soft transition hover:border-green hover:text-green disabled:opacity-60"
          >
            Set live
          </button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="font-mono text-[0.6rem] uppercase tracking-wide text-ink-soft hover:text-[#a8461a] disabled:opacity-60"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// Dashboard "Homepage" tab — lets staff pick what shows behind "Order
// ahead. Skip the line." on the storefront: one of the built-in ambient
// effects, their own uploaded photo/video (from a library, one active
// at a time), or a plain background. See lib/hero.ts + app/page.tsx +
// components/hero/HeroBackground.tsx for how the choice actually renders.
export default function HeroPanel({
  effect,
  media,
  onRefresh,
}: {
  effect: HeroEffect;
  media: HeroMedia[];
  onRefresh: () => void;
}) {
  // Clicking a card only stages a choice locally — it doesn't touch the
  // database until Save is pressed. `effect` (the prop) is what's
  // actually live on the homepage right now; `selected` is what's
  // highlighted in the picker, which starts out matching `effect` but
  // can drift from it while staff are deciding.
  const [selected, setSelected] = useState<HeroEffect>(effect);
  const liveRef = useRef(effect);
  const [savingEffect, setSavingEffect] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Follows the server's live effect — but only when staff don't have an
  // unsaved pick of their own. Without that guard, an unrelated realtime
  // update (a new order coming in, a stock edit from someone else) would
  // silently discard whatever they'd just clicked, before they got to
  // press Save.
  useEffect(() => {
    if (selected === liveRef.current) {
      setSelected(effect);
    }
    liveRef.current = effect;
    // `selected` intentionally isn't a dependency — this effect only
    // reacts to the live value changing, not to the user's own picks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect]);

  const dirty = selected !== effect;

  const handleSave = async () => {
    if (!dirty || savingEffect) return;
    setError(null);
    setSavingEffect(true);
    const ok = await setHeroEffect(selected);
    setSavingEffect(false);
    if (ok) onRefresh();
    else setError("Couldn't save that — try again.");
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    const kind = file.type.startsWith("video/") ? "video" : "photo";
    if (!file.type.startsWith("video/") && !file.type.startsWith("image/")) {
      setError("That file isn't a photo or video.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("That file's over the 60MB limit — try a smaller photo/video.");
      return;
    }

    setUploading(true);
    const result = await uploadHeroMedia(file, kind);
    setUploading(false);
    if (result) onRefresh();
    else setError("Couldn't upload that — try again.");
  };

  const handleSetActive = async (id: string) => {
    setError(null);
    setBusyId(id);
    const ok = await setActiveHeroMedia(id);
    setBusyId(null);
    if (ok) onRefresh();
    else setError("Couldn't set that live — try again.");
  };

  const handleDelete = async (item: HeroMedia) => {
    setError(null);
    setBusyId(item.id);
    const ok = await deleteHeroMedia(item);
    setBusyId(null);
    if (ok) onRefresh();
    else setError("Couldn't delete that — try again.");
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
          Homepage Background
        </p>
        <p className="mt-1 font-body text-sm text-ink-soft">
          Controls what&apos;s behind &quot;Order ahead. Skip the line.&quot; on the storefront homepage.
          Pick one below, then hit Save to make it live.
        </p>

        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {HERO_EFFECTS.map((opt) => {
            const isSelected = selected === opt.value;
            const isLive = effect === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setSelected(opt.value)}
                disabled={savingEffect}
                className={`rounded-lg border p-3 text-left transition disabled:opacity-60 ${
                  isSelected ? "border-green bg-green-tint" : "border-line bg-paper hover:border-green/60"
                }`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="font-body text-sm font-semibold text-ink">{opt.label}</span>
                  {isLive && (
                    <span className="font-mono text-[0.55rem] font-semibold uppercase tracking-wide text-green-deep">
                      Live
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block font-body text-xs text-ink-soft">{opt.description}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || savingEffect}
            className="rounded-full bg-green px-4 py-1.5 font-mono text-xs font-semibold text-white transition hover:bg-green-deep disabled:opacity-50"
          >
            {savingEffect ? "Saving…" : "Save"}
          </button>
          {dirty && !savingEffect && (
            <span className="font-mono text-[0.65rem] uppercase tracking-wide text-gold-ink">
              Unsaved change — the homepage still shows{" "}
              {HERO_EFFECTS.find((o) => o.value === effect)?.label ?? effect}
            </span>
          )}
        </div>
      </div>

      {selected === "custom" && (
        <div className="rounded-lg border border-line bg-panel p-4">
          <p className="font-mono text-[0.65rem] uppercase tracking-wide text-ink-soft">
            Photo &amp; Video Library
          </p>
          <p className="mt-1 font-body text-sm text-ink-soft">
            Upload as many photos and videos as you want, then pick which one is live. A video
            plays muted and on a loop; up to 60MB per file, straight from your phone&apos;s camera
            or your photo library. Setting one live here works right away — it doesn&apos;t need
            the Save button above, only choosing &quot;Your Photo / Video&quot; as the background does.
          </p>

          <label className="mt-3 inline-block w-fit cursor-pointer rounded-full border border-line px-3.5 py-1.5 font-mono text-xs font-semibold text-ink-soft transition hover:border-green hover:text-green">
            {uploading ? "Uploading…" : "Add Photo / Video"}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              onChange={handleUpload}
              disabled={uploading}
              className="hidden"
            />
          </label>

          {media.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {media.map((m) => (
                <MediaThumb
                  key={m.id}
                  media={m}
                  busy={busyId === m.id}
                  onSetActive={() => handleSetActive(m.id)}
                  onDelete={() => handleDelete(m)}
                />
              ))}
            </div>
          )}
          {media.length === 0 && (
            <p className="mt-3 font-body text-xs text-ink-soft">
              Nothing uploaded yet — the homepage shows a plain background until you add
              something and set it live.
            </p>
          )}
        </div>
      )}

      {error && <p className="font-body text-xs text-[#a8461a]">{error}</p>}
    </div>
  );
}
