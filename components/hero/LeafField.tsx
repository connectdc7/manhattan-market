import type { CSSProperties } from "react";
import { fallingLeaves } from "@/lib/hero-effects";

// A single falling autumn leaf — a simple rounded five-point maple-leaf
// silhouette with a center vein, in two warm tones (colorA the fill,
// colorB the vein/edge) picked per-leaf from LEAF_COLORS in
// lib/hero-effects.ts. Simpler than the cherry-blossom Petal shape
// (petals need the notched sakura outline to read correctly; a leaf
// just needs a recognizable pointed-lobe silhouette).
function Leaf({ colorA, colorB, className, style }: { colorA: string; colorB: string; className: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style}>
      <path
        d="M12,1.5 C15,5 22,7.5 21,13 C20.2,17.5 16,17 14.5,15.5 C15,18 16,20 18,22.5 C14.5,21 12.5,19 12,17 C11.5,19 9.5,21 6,22.5 C8,20 9,18 9.5,15.5 C8,17 3.8,17.5 3,13 C2,7.5 9,5 12,1.5 Z"
        fill={colorA}
        stroke={colorB}
        strokeOpacity="0.5"
        strokeWidth="0.4"
      />
      <path
        d="M12,3 L12,20.5 M12,9 L18,12 M12,9 L6,12 M12,13.5 L16.5,16"
        fill="none"
        stroke={colorB}
        strokeOpacity="0.4"
        strokeWidth="0.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

// "Golden Autumn Leaves" hero effect — same fall+flutter, wrap/inner
// split as petals (see PetalField.tsx), just heavier/faster tumbling
// leaves in warm fall colors and no "settled drift" along the bottom.
export default function LeafField() {
  return (
    <div className="leaf-field" aria-hidden="true">
      {fallingLeaves(20).map((l, i) => (
        <span key={`leaf-fall-${i}`} className="leaf-fall-wrap" style={l.style}>
          <Leaf colorA={l.colorA} colorB={l.colorB} className="leaf leaf-fall-inner" style={{}} />
        </span>
      ))}
    </div>
  );
}
