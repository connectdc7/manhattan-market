// Deterministic pseudo-random placement/timing for the homepage hero's
// falling cherry-blossom petals and the fallen-petal drift along its
// bottom edge. Deterministic (not Math.random) so the server-rendered
// markup never mismatches what the client hydrates — there's no client
// state here, just CSS animation, but this keeps every request's output
// stable and avoids any hydration warning.
import type { CSSProperties } from "react";

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Falling petals — pale sakura pink toward the edges. colorB is used
// both as the deeper "blush" wash near the base of the petal and as the
// vein/outline tone, which is what a real cherry blossom petal actually
// looks like (light overall, rosier where it attaches to the flower).
const PETAL_PINKS: [string, string][] = [
  ["#ffeaf3", "#e8779f"],
  ["#ffd9e9", "#e0688f"],
  ["#ffe3ee", "#df7898"],
];

// Petals that have already landed — a touch more saturated than the
// falling ones, since a drift of settled petals reads darker/denser
// than a single one caught in the light. Scattered along the bottom
// edge, this drift doubles as the section's divider (no hard border
// line needed).
const PETAL_GROUND: [string, string][] = [
  ["#f9d0e0", "#d6598c"],
  ["#f7b8d0", "#c94b7c"],
  ["#f3c3d8", "#b8446f"],
  ["#eec2d8", "#c86f95"],
  ["#f4a9c8", "#a83a63"],
];

function pick<T>(arr: T[], t: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(t * arr.length))];
}

export interface Petal {
  style: CSSProperties;
  colorA: string;
  colorB: string;
}

// Petals still drifting down through the hero, looping from top to
// bottom. --flutter-dur/--flutter-delay drive the tumble (see
// @keyframes petal-flutter in globals.css) — a real rotation plus a
// scaleX "edge-on" flip, independent of the fall itself.
export function fallingPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.1 + 1);
    const b = rand(i * 7.7 + 2);
    const c = rand(i * 5.3 + 3);
    const d = rand(i * 2.9 + 4);
    const e = rand(i * 9.4 + 5);
    const [colorA, colorB] = pick(PETAL_PINKS, e);
    return {
      colorA,
      colorB,
      style: {
        "--x": `${(a * 94 + 2).toFixed(1)}%`,
        "--size": `${(10 + b * 8).toFixed(1)}px`,
        "--o": (0.6 + c * 0.35).toFixed(2),
        "--fall-dur": `${(11 + a * 10).toFixed(1)}s`,
        "--fall-delay": `-${(d * 20).toFixed(1)}s`,
        "--flutter-dur": `${(3 + b * 3).toFixed(1)}s`,
        "--flutter-delay": `-${(c * 6).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// Petals that have already "landed" along the bottom edge. "depth"
// pushes some further back (smaller, fainter, higher up) and some
// further forward (bigger, bolder, lower down) so the drift reads as
// having real volume, not a flat row of identical petals.
export function groundPetals(count: number): Petal[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 4.4 + 11);
    const b = rand(i * 6.6 + 12);
    const c = rand(i * 8.8 + 13);
    const e = rand(i * 9.4 + 14);
    const depth = rand(i * 11.3 + 15); // 0 = far/back, 1 = near/front
    const [colorA, colorB] = pick(PETAL_GROUND, e);
    return {
      colorA,
      colorB,
      style: {
        "--x": `${(a * 99).toFixed(1)}%`,
        "--y": `${(80 + depth * 19).toFixed(1)}%`,
        "--size": `${(7 + (1 - depth) * 5 + c * 7).toFixed(1)}px`,
        "--o": (0.65 + depth * 0.32).toFixed(2),
        "--rot": `${(b * 360 - 180).toFixed(0)}deg`,
        "--idle-dur": `${(3 + c * 3).toFixed(1)}s`,
        "--idle-delay": `-${(a * 5).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}
