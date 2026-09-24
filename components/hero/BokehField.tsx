import type { CSSProperties } from "react";
import { bokehLights } from "@/lib/hero-effects";

// "City Bokeh Lights" hero effect — soft glowing dots scattered across
// the whole hero (not falling from the top like the others), each
// independently drifting and twinkling. One element per light — see
// the comment in lib/hero-effects.ts's bokehLights for why drift
// (transform) and twinkle (opacity) can safely share one element here.
export default function BokehField() {
  return (
    <div className="bokeh-field" aria-hidden="true">
      {bokehLights(24).map((b, i) => (
        <span
          key={`bokeh-${i}`}
          className="bokeh-light"
          style={{ ...b.style, backgroundColor: b.color } as CSSProperties}
        />
      ))}
    </div>
  );
}
