// The Manhattan Market logo — custom block letterforms for "MANHATTAN"
// with a skyline built directly into the tops of the letters (twin towers
// rising out of the H, a tiered Empire-State-style spire replacing the
// second A's peak, a tapered Chrysler-style spire on the first T, and
// smaller stepped rooftops on the rest), the same idea as the client's
// embroidered patch, with "MARKET" set below in plain bold caps.
//
// Every letter is drawn as flat-color shapes sharing one `currentColor` —
// wrap it in a text color class (text-ink, text-white, ...) to recolor it
// for light or dark backgrounds. The base letterforms are always visible;
// the skyline details sitting on top of them are each their own
// <g className="skyline-bldg">, staggered left to right (see the
// .skyline-bldg rule in globals.css) so they rise into place once when the
// mark mounts, like the site's other on-load reveals.

const STAGGER_MS = 45;
let _delayIndex = 0;
function nextDelay() {
  const d = { animationDelay: `${_delayIndex * STAGGER_MS}ms` };
  _delayIndex += 1;
  return d;
}

export function SkylineWordmark({ className = "h-24 w-auto" }: { className?: string }) {
  _delayIndex = 0; // reset so re-renders stagger the same way every time
  return (
    <svg viewBox="0 0 1104 420" className={className} aria-hidden="true">
      <g fill="currentColor">
        {/* ===== M ===== */}
        <path d="M20 300 L20 140 L50 140 L50 300 Z" />
        <path d="M140 300 L140 140 L170 140 L170 300 Z" />
        <path d="M52 140 L84 140 L110 236 L78 236 Z" />
        <path d="M138 140 L106 140 L80 236 L112 236 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M84 236 L84 196 L104 196 L104 236 Z" />
          <path d="M89 196 L89 130 L99 130 L99 196 Z" />
        </g>

        {/* ===== A (1) ===== */}
        <path d="M178 300 L208 300 L232 150 L212 150 Z" />
        <path d="M283 300 L253 300 L229 150 L249 150 Z" />
        <path d="M190 235 L190 210 L272 210 L272 235 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M220 150 L220 130 L240 130 L240 150 Z" />
        </g>

        {/* ===== N (1) ===== */}
        <path d="M291 300 L291 140 L321 140 L321 300 Z" />
        <path d="M406 300 L406 140 L376 140 L376 300 Z" />
        <path d="M291 140 L321 140 L406 300 L376 300 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M296 140 L296 118 L316 118 L316 140 Z" />
        </g>

        {/* ===== H — twin towers ===== */}
        <path d="M414 300 L414 140 L444 140 L444 300 Z" />
        <path d="M499 300 L499 140 L529 140 L529 300 Z" />
        <path d="M414 220 L414 190 L529 190 L529 220 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M414 140 L414 40 L444 40 L444 140 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M425 40 L425 18 L433 18 L433 40 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M499 140 L499 70 L529 70 L529 140 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M510 70 L510 48 L518 48 L518 70 Z" />
        </g>

        {/* ===== A (2) — tiered spire, tallest point of the mark ===== */}
        <path d="M537 300 L567 300 L597 190 L577 190 Z" />
        <path d="M642 300 L612 300 L582 190 L602 190 Z" />
        <path d="M549 235 L549 210 L630 210 L630 235 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M565 190 L565 150 L614 150 L614 190 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M577 150 L577 100 L602 100 L602 150 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M582 100 L582 60 L597 60 L597 100 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M587 60 L587 15 L592 15 L592 60 Z" />
        </g>

        {/* ===== T (1) — tapered spire ===== */}
        <path d="M650 170 L650 140 L745 140 L745 170 Z" />
        <path d="M682 170 L682 300 L713 300 L713 170 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M670 140 L670 100 L725 100 L725 140 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M680 100 L715 100 L705 60 L690 60 Z" />
        </g>
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M695 60 L695 20 L700 20 L700 60 Z" />
        </g>

        {/* ===== T (2) ===== */}
        <path d="M753 170 L753 140 L848 140 L848 170 Z" />
        <path d="M785 170 L785 300 L816 300 L816 170 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M780 140 L780 110 L821 110 L821 140 Z" />
        </g>

        {/* ===== A (3) ===== */}
        <path d="M856 300 L886 300 L916 150 L896 150 Z" />
        <path d="M961 300 L931 300 L901 150 L921 150 Z" />
        <path d="M868 235 L868 210 L950 210 L950 235 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M898 150 L898 130 L918 130 L918 150 Z" />
        </g>

        {/* ===== N (2) ===== */}
        <path d="M969 300 L969 150 L999 150 L999 300 Z" />
        <path d="M1084 300 L1084 150 L1054 150 L1054 300 Z" />
        <path d="M969 150 L999 150 L1084 300 L1054 300 Z" />
        <g className="skyline-bldg" style={nextDelay()}>
          <path d="M974 150 L974 130 L994 130 L994 150 Z" />
        </g>

        {/* ===== MARKET ===== */}
        <text
          x="552"
          y="378"
          textAnchor="middle"
          fontFamily="Anton, 'IBM Plex Sans', sans-serif"
          fontSize="52"
          letterSpacing="16"
        >
          MARKET
        </text>
      </g>
    </svg>
  );
}
