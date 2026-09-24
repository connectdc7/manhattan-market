import type { CSSProperties } from "react";
import { fallingPetals, groundPetals } from "@/lib/petals";

// A single cherry-blossom petal — the notched, rounded outline every
// real sakura petal has (two soft lobes with a shallow cleft between
// them at the tip, tapering to a point at the base). Reused for every
// petal on the page; only its fill/blush colors (colorA/colorB), size,
// position, and timing (all driven by lib/petals.ts + the CSS custom
// properties on `style`) differ from one instance to the next. The
// blush ellipse (a real petal is rosier near where it attaches to the
// flower) and the highlight ellipse (light catching the curve) are
// what push this past a flat colored shape toward something that reads
// as an actual petal.
function Petal({ colorA, colorB, className, style }: { colorA: string; colorB: string; className: string; style: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 28" className={className} style={style}>
      <path
        d="M9,0.6 Q10.8,2.6 12,3.2 Q13.2,2.6 15,0.6 Q21,3 22.4,9.5 Q23.6,17 12,27.4 Q0.4,17 1.6,9.5 Q3,3 9,0.6 Z"
        fill={colorA}
        stroke={colorB}
        strokeOpacity="0.55"
        strokeWidth="0.35"
      />
      <ellipse cx="12" cy="19.5" rx="5.5" ry="7.2" fill={colorB} opacity="0.28" />
      <ellipse cx="9.3" cy="7.5" rx="2.1" ry="4" fill="#ffffff" opacity="0.3" transform="rotate(-18 9.3 7.5)" />
      <path
        d="M12,3.6 L12,26.6 M12,9 L19.5,13 M12,9 L4.5,13 M12,15 L17.5,19.5 M12,15 L6.5,19.5"
        fill="none"
        stroke={colorB}
        strokeOpacity="0.35"
        strokeWidth="0.35"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The "Pink Petals" hero effect — the original/default look, unchanged.
// Pulled out of app/page.tsx so it sits alongside the other selectable
// hero effects in components/hero/ (see HeroBackground.tsx), instead of
// being the only one hardcoded directly into the page.
export default function PetalField() {
  return (
    <div className="petal-field" aria-hidden="true">
      {/* Falling petals are split across two nested elements on
          purpose: the outer span owns position + the vertical fall
          (a GPU-composited `transform`, not `top` — animating `top`
          forces a layout recalculation on every frame, which is
          expensive with this many elements and was making the fall
          look sluggish/near-frozen on phones); the inner <Petal>
          owns the tumble (rotate + edge-on flip). CSS custom
          properties set on the outer span (--x, --size, --fall-dur,
          etc.) inherit down to the inner element, so both can
          reference the same values from lib/petals.ts. */}
      {fallingPetals(18).map((p, i) => (
        <span key={`petal-fall-${i}`} className="petal-fall-wrap" style={p.style}>
          <Petal colorA={p.colorA} colorB={p.colorB} className="petal petal-fall-inner" style={{}} />
        </span>
      ))}
      {groundPetals(110).map((p, i) => (
        <Petal
          key={`petal-ground-${i}`}
          colorA={p.colorA}
          colorB={p.colorB}
          className="petal petal-ground"
          style={p.style}
        />
      ))}
    </div>
  );
}
