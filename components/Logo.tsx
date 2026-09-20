// The Manhattan Market logo — custom block letterforms for "MANHATTAN"
// with a skyline built directly into the tops of the letters (twin towers
// rising out of the H, a tiered Empire-State-style spire replacing the
// second A's peak, a tapered Chrysler-style spire on the first T, and
// smaller stepped rooftops on the rest), the same idea as the client's
// embroidered patch, with "MARKET" set below in plain bold caps.
//
// Every letter is drawn as flat-color shapes sharing one `currentColor` —
// wrap it in a text color class (text-ink, text-white, ...) to recolor it
// for light or dark backgrounds. Markup is split into two groups so the
// letterforms (always visible, always still) and the skyline details
// sitting on top of them (animated) don't fight over the same properties:
//
//   <g className="skyline-letters">   — the plain letter strokes, static
//   <g className="skyline-hover-wrap"> — every skyline-bldg roofline
//
// Each roofline is its own <g className="skyline-bldg">, staggered left to
// right (see globals.css) so it rises into place once on mount. The whole
// skyline-hover-wrap additionally gets a single, un-staggered "hop" when
// the logo link is hovered/focused — kept on a wrapper that has no other
// animation of its own, since layering a second animation directly onto
// the already-animated skyline-bldg elements fights the mount animation's
// staggered delays and forwards fill (tried it — it flickers).
const STAGGER_MS = 45;
let _delayIndex = 0;
function nextDelay() {
  const d = { animationDelay: `${_delayIndex * STAGGER_MS}ms` };
  _delayIndex += 1;
  return d;
}

// A lit window: gold, flickering on its own independent cycle (duration/
// delay handed in per-window below) so the skyline doesn't pulse in
// lockstep — closer to how a real skyline's lights flicker at night. The
// delay is offset past the rise-in above so windows don't start twinkling
// mid-entrance.
function twinkle(durationS: number, delayS: number) {
  return {
    fill: "var(--gold)",
    animationDuration: `${durationS}s`,
    animationDelay: `${0.7 + delayS}s`,
  };
}

// An obstruction beacon atop a tower — a sharper, slower blink than the
// windows (closer to a real rooftop warning light), so the mark still
// reads as alive even scaled down small in the header, where the windows
// mostly disappear.
function beacon(delayS: number) {
  return {
    fill: "var(--gold)",
    animationDelay: `${0.7 + delayS}s`,
  };
}

export function SkylineWordmark({ className = "h-24 w-auto" }: { className?: string }) {
  _delayIndex = 0; // reset so re-renders stagger the same way every time
  return (
    <svg viewBox="0 0 1104 500" className={className} aria-hidden="true">
      <g fill="currentColor">
        {/* ===== letterforms — static ===== */}
        <g className="skyline-letters">
          {/* M */}
          <path d="M20 300 L20 140 L50 140 L50 300 Z" />
          <path d="M140 300 L140 140 L170 140 L170 300 Z" />
          <path d="M52 140 L84 140 L110 236 L78 236 Z" />
          <path d="M138 140 L106 140 L80 236 L112 236 Z" />
          {/* A (1) */}
          <path d="M178 300 L208 300 L232 150 L212 150 Z" />
          <path d="M283 300 L253 300 L229 150 L249 150 Z" />
          <path d="M190 235 L190 210 L272 210 L272 235 Z" />
          {/* N (1) */}
          <path d="M291 300 L291 140 L321 140 L321 300 Z" />
          <path d="M406 300 L406 140 L376 140 L376 300 Z" />
          <path d="M291 140 L321 140 L406 300 L376 300 Z" />
          {/* H */}
          <path d="M414 300 L414 140 L444 140 L444 300 Z" />
          <path d="M499 300 L499 140 L529 140 L529 300 Z" />
          <path d="M414 220 L414 190 L529 190 L529 220 Z" />
          {/* A (2) */}
          <path d="M537 300 L567 300 L597 190 L577 190 Z" />
          <path d="M642 300 L612 300 L582 190 L602 190 Z" />
          <path d="M549 235 L549 210 L630 210 L630 235 Z" />
          {/* T (1) */}
          <path d="M650 170 L650 140 L745 140 L745 170 Z" />
          <path d="M682 170 L682 300 L713 300 L713 170 Z" />
          {/* T (2) */}
          <path d="M753 170 L753 140 L848 140 L848 170 Z" />
          <path d="M785 170 L785 300 L816 300 L816 170 Z" />
          {/* A (3) */}
          <path d="M856 300 L886 300 L916 150 L896 150 Z" />
          <path d="M961 300 L931 300 L901 150 L921 150 Z" />
          <path d="M868 235 L868 210 L950 210 L950 235 Z" />
          {/* N (2) */}
          <path d="M969 300 L969 150 L999 150 L999 300 Z" />
          <path d="M1084 300 L1084 150 L1054 150 L1054 300 Z" />
          <path d="M969 150 L999 150 L1084 300 L1054 300 Z" />
        </g>

        {/* ===== skyline — animated ===== */}
        <g className="skyline-hover-wrap">
          {/* M — small building peeking out of the notch */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M84 236 L84 196 L104 196 L104 236 Z" />
            <path d="M89 196 L89 130 L99 130 L99 196 Z" />
            <rect className="skyline-window" x="91" y="155" width="6" height="12" style={twinkle(2.8, 0.3)} />
          </g>

          {/* A (1) — small parapet */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M220 150 L220 130 L240 130 L240 150 Z" />
          </g>

          {/* N (1) — small step */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M296 140 L296 118 L316 118 L316 140 Z" />
            <rect className="skyline-window" x="302" y="124" width="8" height="10" style={twinkle(2.2, 0.9)} />
          </g>

          {/* H — twin towers, the tallest pair */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M414 140 L414 40 L444 40 L444 140 Z" />
            <rect className="skyline-window" x="422" y="65" width="8" height="12" style={twinkle(1.9, 0.2)} />
            <rect className="skyline-window" x="422" y="100" width="8" height="12" style={twinkle(2.6, 1.1)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M425 40 L425 18 L433 18 L433 40 Z" />
            <circle className="skyline-beacon" cx="429" cy="15" r="4" style={beacon(0)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M499 140 L499 70 L529 70 L529 140 Z" />
            <rect className="skyline-window" x="507" y="90" width="8" height="12" style={twinkle(2.4, 0.6)} />
            <rect className="skyline-window" x="507" y="115" width="8" height="12" style={twinkle(3.1, 1.4)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M510 70 L510 48 L518 48 L518 70 Z" />
            <circle className="skyline-beacon" cx="514" cy="45" r="3.5" style={beacon(0.9)} />
          </g>

          {/* A (2) — tiered spire, tallest point of the mark */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M565 190 L565 150 L614 150 L614 190 Z" />
            <rect className="skyline-window" x="572" y="162" width="8" height="12" style={twinkle(2.1, 0.5)} />
            <rect className="skyline-window" x="598" y="162" width="8" height="12" style={twinkle(2.9, 1.2)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M577 150 L577 100 L602 100 L602 150 Z" />
            <rect className="skyline-window" x="584" y="115" width="7" height="11" style={twinkle(2.5, 0.8)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M582 100 L582 60 L597 60 L597 100 Z" />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M587 60 L587 15 L592 15 L592 60 Z" />
            <circle className="skyline-beacon" cx="589.5" cy="12" r="5" style={beacon(1.6)} />
          </g>

          {/* T (1) — tapered spire */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M670 140 L670 100 L725 100 L725 140 Z" />
            <rect className="skyline-window" x="680" y="112" width="8" height="12" style={twinkle(2.3, 0.4)} />
            <rect className="skyline-window" x="705" y="112" width="8" height="12" style={twinkle(3, 1.6)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M680 100 L715 100 L705 60 L690 60 Z" />
            <rect className="skyline-window" x="693" y="75" width="7" height="10" style={twinkle(2, 1)} />
          </g>
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M695 60 L695 20 L700 20 L700 60 Z" />
          </g>

          {/* T (2) — small step */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M780 140 L780 110 L821 110 L821 140 Z" />
          </g>

          {/* A (3) — small parapet */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M898 150 L898 130 L918 130 L918 150 Z" />
          </g>

          {/* N (2) — small end-cap */}
          <g className="skyline-bldg" style={nextDelay()}>
            <path d="M974 150 L974 130 L994 130 L994 150 Z" />
          </g>
        </g>

        {/* ===== MARKET — run nearly the full width, like a street
            beneath the skyline ===== */}
        <text
          x="552"
          y="460"
          textAnchor="middle"
          fontFamily="Anton, 'IBM Plex Sans', sans-serif"
          fontSize="150"
          letterSpacing="46"
        >
          MARKET
        </text>
      </g>
    </svg>
  );
}
