import type { Metadata } from "next";
import Link from "next/link";
import { getGalleryPhotos, getGalleryTiles } from "@/lib/gallery";
import PageHero from "@/components/PageHero";
import { BUSINESS } from "@/lib/site";

export const metadata: Metadata = {
  title: "Gallery — Inside Manhattan Market, Woodley Park DC",
  description:
    "Photos from inside Manhattan Market at 2647 Connecticut Ave NW — our shelves, drinks, snacks and the counter, steps from the Woodley Park–Zoo Metro in Washington, DC.",
  alternates: {
    canonical: "/gallery",
  },
};

// Photos change whenever staff upload new ones from the dashboard.
export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const [photos, tiles] = await Promise.all([getGalleryPhotos(), getGalleryTiles()]);

  return (
    <div>
      <PageHero
        eyebrow="Gallery"
        title={
          <>
            A look inside <span className="text-gold">Manhattan Market</span>
          </>
        }
        subtitle={`Your corner store at ${BUSINESS.streetAddress} — come see us, or order online.`}
      />

      <div className="mx-auto max-w-6xl px-5 py-12">
        {photos.length > 0 ? (
          <div className="columns-1 gap-5 sm:columns-2 lg:columns-3">
            {photos.map((p, i) => (
              <figure
                key={p.id}
                className={`mb-5 break-inside-avoid overflow-hidden rounded-2xl border-2 border-ink bg-paper shadow-[5px_5px_0_var(--ink)] ${
                  i % 3 === 1 ? "sm:rotate-[0.6deg]" : i % 3 === 2 ? "sm:-rotate-[0.6deg]" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.caption || "Inside Manhattan Market, Woodley Park"} loading="lazy" className="w-full" />
                {p.caption && (
                  <figcaption className="border-t-2 border-ink px-4 py-2.5 font-body text-sm font-medium text-ink">{p.caption}</figcaption>
                )}
              </figure>
            ))}
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {tiles.map((tile) =>
              tile.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={tile.key}
                  src={tile.image_url}
                  alt={tile.label}
                  className="h-56 w-full rounded-2xl border-2 border-ink object-cover shadow-[5px_5px_0_var(--ink)]"
                />
              ) : (
                <div
                  key={tile.key}
                  className="font-poster flex h-56 items-center justify-center rounded-2xl border-2 border-ink text-2xl uppercase text-white shadow-[5px_5px_0_var(--ink)]"
                  style={{ backgroundColor: tile.color }}
                >
                  {tile.label}
                </div>
              )
            )}
          </div>
        )}

        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <p className="font-poster text-3xl uppercase text-ink sm:text-4xl">Like what you see?</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              href="/order"
              className="shadow-sticker rounded-full border-2 border-ink bg-pink-deep px-7 py-3.5 font-mono text-sm font-bold uppercase tracking-wide text-white transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-none"
            >
              Order online
            </Link>
            <a
              href={BUSINESS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-full border-2 border-ink bg-paper px-7 py-3.5 font-mono text-sm font-bold uppercase tracking-wide text-ink transition hover:bg-gold-tint"
            >
              Follow on Instagram
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
