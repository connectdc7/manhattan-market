import { fallingSnow } from "@/lib/hero-effects";

// "Falling Snow" hero effect — plain soft-white dots falling and
// swaying, split across a wrap (fall) and inner (sway) element for the
// same reason petals are (see lib/petals.ts / PetalField.tsx): two
// `transform` animations on one element would fight each other.
export default function SnowField() {
  return (
    <div className="snow-field" aria-hidden="true">
      {fallingSnow(70).map((s, i) => (
        <span key={`snow-${i}`} className="snow-fall-wrap" style={s.style}>
          <span className="snow-fall-inner">
            <span className="snowflake" />
          </span>
        </span>
      ))}
    </div>
  );
}
