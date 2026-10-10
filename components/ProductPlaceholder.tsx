// What a product shows in place of a photo: the item's initials on a
// colored tile, with the category underneath. Replaces the old "sample
// photo" box now that the real Clover catalog (thousands of items, none
// with photos yet) is live. Each category gets its own color so the Order
// page doesn't look like one solid block.
//
// Works in both server and client components (no hooks).

const DEFAULT_SWATCH = "#21594a";
const PALETTE = ["#21594a", "#b8456a", "#8a5a14", "#2f5d8a", "#6b4c8a", "#3d6b3a", "#9a4a2a", "#4a5a66"];

function colorFor(category: string, swatch?: string | null): string {
  if (swatch && swatch.toLowerCase() !== DEFAULT_SWATCH) return swatch;
  let h = 0;
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initialsOf(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !/^\d+(oz|ml|l|g|lb|ct|pk)?$/i.test(w));
  const letters = words.slice(0, 2).map((w) => w[0].toUpperCase());
  return letters.join("") || name.trim().slice(0, 1).toUpperCase() || "?";
}

export default function ProductPlaceholder({
  name,
  category,
  swatch,
  className = "",
  grayscale = false,
}: {
  name: string;
  category: string;
  swatch?: string | null;
  className?: string;
  grayscale?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={name}
      className={`flex flex-col items-center justify-center gap-1 ${grayscale ? "grayscale" : ""} ${className}`}
      style={{ backgroundColor: colorFor(category, swatch) }}
    >
      <span className="font-display text-4xl font-bold leading-none text-white/90">{initialsOf(name)}</span>
      <span className="max-w-[85%] truncate font-mono text-[0.6rem] uppercase tracking-widest text-white/65">
        {category}
      </span>
    </div>
  );
}
