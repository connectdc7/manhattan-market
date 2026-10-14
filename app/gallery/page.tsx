import type { Metadata } from "next";
import { getGalleryPhotos, getGalleryTiles } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A look inside Manhattan Market — our storefront, hot food counter, and shelves in Woodley Park, Washington, DC.",
  alternates: {
    canonical: "/gallery",
  },
};

// Photos come from Supabase and can change any time staff generate or
// upload new ones from the dashboard, so this needs a fresh read on every
// request rather than being baked in once at build time.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [photos, tiles] = await Promise.all([getGalleryPhotos(), getGalleryTiles()]);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow text-green">Gallery</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        A look inside Manhattan Market
      </h1>
      {photos.length > 0 ? (
        <div className="mt-8 columns-1 gap-4 sm:columns-2 lg:columns-3">
          {photos.map((p) => (
            <figure key={p.id} className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-line bg-paper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption || "Manhattan Market"} loading="lazy" className="w-full" />
              {p.caption && (
                <figcaption className="px-3 py-2 font-body text-sm text-ink-soft">{p.caption}</figcaption>
              )}
            </figure>
          ))}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((tile) =>
            tile.image_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={tile.key}
                src={tile.image_url}
                alt={tile.label}
                className="h-48 w-full rounded-lg object-cover"
              />
            ) : (
              <div
                key={tile.key}
                className="flex h-48 items-center justify-center rounded-lg font-mono text-xs uppercase tracking-widest text-white/80"
                style={{ backgroundColor: tile.color }}
              >
                {tile.label}
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
