// Deterministic pseudo-random placement/timing/color for the homepage
// hero's falling/collected flower petals. Deterministic (not Math.random)
// so the server-rendered markup never mismatches what the client
// hydrates — there's no client state here, just CSS animation, but this
// keeps every request's output stable and avoids any hydration warning.
import type { CSSProperties } from "react";

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Each petal is a soft radial gradient from a pale center to a pink edge —
// mimicking real rose/blossom petals, which are cream at the base and
// blush pink toward the curled rim. A few (colorA, colorB) pairs give
// variety from nearly-white to a deeper pink, like a real scattered pile.
const PETAL_GRADIENTS: [string, string][] = [
  ["#fffdfc", "#fbe9ec"],
  ["#fffaf9", "#f6c9d3"],
  ["#fff7f6", "#f2a3b7"],
  ["#fffdfc", "#f6b9c6"],
  ["#fff9f8", "#e98aa6"],
];

function pickGradient(t: number): [string, string] {
  const idx = Math.min(PETAL_GRADIENTS.length - 1, Math.floor(t * PETAL_GRADIENTS.length));
  return PETAL_GRADIENTS[idx];
}

export interface Petal {
  style: CSSProperties;
  colorA: string;
  colorB: string;
}

// Petals still drifting down through the hero, looping from top to bottom.
export function fallingPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.1 + 1);
    const b = rand(i * 7.7 + 2);
    const c = rand(i * 5.3 + 3);
    const d = rand(i * 2.9 + 4);
    const e = rand(i * 9.4 + 5);
    const [colorA, colorB] = pickGradient(e);
    return {
      colorA,
      colorB,
      style: {
        "--x": `${(a * 94 + 2).toFixed(1)}%`,
        "--size": `${(10 + b * 9).toFixed(1)}px`,
        "--o": (0.6 + c * 0.35).toFixed(2),
        "--fall-dur": `${(11 + a * 10).toFixed(1)}s`,
        "--fall-delay": `-${(d * 20).toFixed(1)}s`,
        "--sway-dur": `${(3 + b * 3).toFixed(1)}s`,
        "--sway-delay": `-${(c * 6).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// Petals that have already "landed" along the bottom edge — a dense drift
// that acts as the section's divider (no hard border line needed). "depth"
// pushes some further back (smaller, fainter, higher up) and some further
// forward (bigger, bolder, lower down) so the pile reads as a heap with
// real volume, not a flat row of identical dots.
export function groundPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 4.4 + 11);
    const b = rand(i * 6.6 + 12);
    const c = rand(i * 8.8 + 13);
    const e = rand(i * 9.4 + 14);
    const depth = rand(i * 11.3 + 15); // 0 = far/back, 1 = near/front
    const [colorA, colorB] = pickGradient(e);
    return {
      colorA,
      colorB,
      style: {
        "--x": `${(a * 99).toFixed(1)}%`,
        "--y": `${(80 + depth * 19).toFixed(1)}%`,
        "--size": `${(8 + (1 - depth) * 6 + c * 8).toFixed(1)}px`,
        "--o": (0.65 + depth * 0.32).toFixed(2),
        "--rot": `${(b * 360 - 180).toFixed(0)}deg`,
        "--idle-dur": `${(3 + c * 3).toFixed(1)}s`,
        "--idle-delay": `-${(a * 5).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}
