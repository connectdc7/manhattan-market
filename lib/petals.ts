// Deterministic pseudo-random placement/timing for the homepage hero's
// falling oak leaves and the fallen-leaf pile along its bottom edge.
// (This file predates the fall refresh and kept its original name — it
// generates leaf data now, not flower petals.) Deterministic (not
// Math.random) so the server-rendered markup never mismatches what the
// client hydrates — there's no client state here, just CSS animation,
// but this keeps every request's output stable and avoids any hydration
// warning.
import type { CSSProperties } from "react";

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Falling leaves all start out a fresh, slightly-varied green — the
// color *phase* (green -> yellow -> gold -> rust -> brown) happens live
// in CSS as each one falls (see the leaf-color keyframes in
// globals.css), not here. colorB is the vein/outline tone.
const LEAF_GREENS: [string, string][] = [
  ["#6f9c54", "#43672f"],
  ["#5c8a4c", "#3f5c34"],
  ["#7aad5e", "#4a6b3a"],
];

// Leaves that have already landed and finished their color change — a
// scattered, varied pile of golds, rusts, and browns along the bottom
// edge, which doubles as this section's divider (no hard border line
// needed).
const LEAF_GROUND: [string, string][] = [
  ["#d9a154", "#a3672f"],
  ["#c1752f", "#8a4f1f"],
  ["#a35d2b", "#723f1a"],
  ["#8b5a2b", "#5f3c1a"],
  ["#6b4423", "#472c16"],
];

function pick<T>(arr: T[], t: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(t * arr.length))];
}

export interface Leaf {
  style: CSSProperties;
  colorA: string;
  colorB: string;
}

// Leaves still drifting down through the hero, looping from top to
// bottom. --fall-dur/--fall-delay drive both the vertical fall AND the
// color-phase animation together (see .leaf-fall in globals.css), so
// every leaf finishes turning brown right as it reaches the ground.
export function fallingLeaves(count: number): Leaf[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.1 + 1);
    const b = rand(i * 7.7 + 2);
    const c = rand(i * 5.3 + 3);
    const d = rand(i * 2.9 + 4);
    const e = rand(i * 9.4 + 5);
    const [colorA, colorB] = pick(LEAF_GREENS, e);
    return {
      colorA,
      colorB,
      style: {
        "--x": `${(a * 94 + 2).toFixed(1)}%`,
        "--size": `${(11 + b * 9).toFixed(1)}px`,
        "--o": (0.6 + c * 0.35).toFixed(2),
        "--fall-dur": `${(11 + a * 10).toFixed(1)}s`,
        "--fall-delay": `-${(d * 20).toFixed(1)}s`,
        "--sway-dur": `${(3 + b * 3).toFixed(1)}s`,
        "--sway-delay": `-${(c * 6).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// Leaves that have already "landed" along the bottom edge — a dense
// drift that acts as the section's divider (no hard border line
// needed). "depth" pushes some further back (smaller, fainter, higher
// up) and some further forward (bigger, bolder, lower down) so the pile
// reads as a heap with real volume, not a flat row of identical leaves.
export function groundLeaves(count: number): Leaf[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 4.4 + 11);
    const b = rand(i * 6.6 + 12);
    const c = rand(i * 8.8 + 13);
    const e = rand(i * 9.4 + 14);
    const depth = rand(i * 11.3 + 15); // 0 = far/back, 1 = near/front
    const [colorA, colorB] = pick(LEAF_GROUND, e);
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
