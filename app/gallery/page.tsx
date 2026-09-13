import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "A look inside Manhattan Market — our storefront, hot food counter, and shelves in Woodley Park, Washington, DC.",
  alternates: {
    canonical: "/gallery",
  },
};

const TILES = [
  { label: "Storefront", color: "#21594a" },
  { label: "Hot food counter", color: "#c98b3a" },
  { label: "Snack aisle", color: "#e0a938" },
  { label: "Coffee station", color: "#6b4226" },
  { label: "Drink cooler", color: "#3e6b4a" },
  { label: "Register", color: "#163d33" },
];

export default function GalleryPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="eyebrow text-green">Gallery</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-ink sm:text-4xl">
        A look inside Manhattan Market
      </h1>
      <p className="mt-2 max-w-xl font-body text-sm text-ink-soft">
        Placeholder tiles for now — real storefront and product photos go here before
        launch.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((tile) => (
          <div
            key={tile.label}
            className="flex h-48 items-center justify-center rounded-lg font-mono text-xs uppercase tracking-widest text-white/80"
            style={{ backgroundColor: tile.color }}
          >
            {tile.label} — sample
          </div>
        ))}
      </div>
    </div>
  );
}
