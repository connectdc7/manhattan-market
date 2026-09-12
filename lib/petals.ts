// Deterministic pseudo-random placement/timing/color for the homepage
// hero's falling apple-blossom petals. Deterministic (not Math.random) so
// the server-rendered markup never mismatches what the client hydrates —
// there's no client state here, just CSS animation, but this keeps every
// request's output stable and avoids any hydration warning risk.
import type { CSSProperties } from "react";

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Apple-blossom petals run mostly white with a soft pink blush — weighted
// toward the lighter end so the field doesn't read as uniformly pink.
const PETAL_COLORS = ["#ffffff", "#fdf1f4", "#fbe9ec", "#f6b9c6", "#f2a3b7"];

function pickColor(t: number): string {
  const idx = Math.min(PETAL_COLORS.length - 1, Math.floor(t * PETAL_COLORS.length));
  return PETAL_COLORS[idx];
}

export interface Petal {
  style: CSSProperties;
  fill: string;
}

// Petals still drifting down through the hero, looping from top to bottom.
export function fallingPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.1 + 1);
    const b = rand(i * 7.7 + 2);
    const c = rand(i * 5.3 + 3);
    const d = rand(i * 2.9 + 4);
    const e = rand(i * 9.4 + 5);
    return {
      fill: pickColor(e),
      style: {
        "--x": `${(a * 94 + 2).toFixed(1)}%`,
        "--size": `${(9 + b * 8).toFixed(1)}px`,
        "--o": (0.55 + c * 0.35).toFixed(2),
        "--fall-dur": `${(11 + a * 10).toFixed(1)}s`,
        "--fall-delay": `-${(d * 20).toFixed(1)}s`,
        "--sway-dur": `${(3 + b * 3).toFixed(1)}s`,
        "--sway-delay": `-${(c * 6).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// Petals that have already "landed" along the bottom edge — resting, but
// with a slow idle wobble so the ground never looks frozen.
export function groundPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 4.4 + 11);
    const b = rand(i * 6.6 + 12);
    const c = rand(i * 8.8 + 13);
    const e = rand(i * 9.4 + 14);
    return {
      fill: pickColor(e),
      style: {
        "--x": `${(a * 96 + 1).toFixed(1)}%`,
        "--y": `${(90 + b * 7).toFixed(1)}%`,
        "--size": `${(8 + c * 7).toFixed(1)}px`,
        "--o": (0.6 + a * 0.3).toFixed(2),
        "--rot": `${(b * 60 - 30).toFixed(0)}deg`,
        "--idle-dur": `${(3 + c * 3).toFixed(1)}s`,
        "--idle-delay": `-${(a * 5).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}
