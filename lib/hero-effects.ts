// Deterministic pseudo-random placement/timing for the homepage hero's
// non-petal ambient effects (snow, leaves, steam, bokeh) — same reasoning
// as lib/petals.ts: deterministic (not Math.random), so server-rendered
// markup never mismatches what the client hydrates, and every request's
// output is stable.
import type { CSSProperties } from "react";

function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], t: number): T {
  return arr[Math.min(arr.length - 1, Math.floor(t * arr.length))];
}

// ---------------------------------------------------------------------------
// Falling snow — simpler motion than petals (no edge-on flip): a fall plus
// a gentle side-to-side sway. Split across wrap/inner the same way petals
// are (see lib/petals.ts's comment on why) so the fall and the sway, both
// `transform` animations, don't fight over the same property on one
// element.
// ---------------------------------------------------------------------------
export interface Snowflake {
  style: CSSProperties;
}

export function fallingSnow(count: number): Snowflake[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.3 + 21);
    const b = rand(i * 7.1 + 22);
    const c = rand(i * 5.9 + 23);
    const d = rand(i * 2.5 + 24);
    return {
      style: {
        "--x": `${(a * 96 + 2).toFixed(1)}%`,
        "--size": `${(4 + b * 7).toFixed(1)}px`,
        "--o": (0.4 + c * 0.5).toFixed(2),
        "--fall-dur": `${(9 + a * 9).toFixed(1)}s`,
        "--fall-delay": `-${(d * 18).toFixed(1)}s`,
        "--sway-dur": `${(3 + b * 3).toFixed(1)}s`,
        "--sway-delay": `-${(c * 6).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// ---------------------------------------------------------------------------
// Falling autumn leaves — same fall+flutter structure as petals, but
// tumbling faster and through a wider rotation range (a falling leaf reads
// as heavier and more chaotic than a petal), in warm fall colors.
// ---------------------------------------------------------------------------
const LEAF_COLORS: [string, string][] = [
  ["#e8a33d", "#a6621a"],
  ["#d97b3f", "#8f4a1e"],
  ["#c9502f", "#7a2f16"],
  ["#e0b23e", "#96731c"],
];

export interface FallingLeaf {
  style: CSSProperties;
  colorA: string;
  colorB: string;
}

export function fallingLeaves(count: number): FallingLeaf[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.7 + 31);
    const b = rand(i * 6.3 + 32);
    const c = rand(i * 5.1 + 33);
    const d = rand(i * 2.7 + 34);
    const e = rand(i * 8.9 + 35);
    const [colorA, colorB] = pick(LEAF_COLORS, e);
    return {
      colorA,
      colorB,
      style: {
        "--x": `${(a * 94 + 2).toFixed(1)}%`,
        "--size": `${(14 + b * 10).toFixed(1)}px`,
        "--o": (0.65 + c * 0.3).toFixed(2),
        "--fall-dur": `${(8 + a * 8).toFixed(1)}s`,
        "--fall-delay": `-${(d * 16).toFixed(1)}s`,
        "--flutter-dur": `${(2.2 + b * 2.2).toFixed(1)}s`,
        "--flutter-delay": `-${(c * 5).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// ---------------------------------------------------------------------------
// Rising coffee steam — the opposite direction from the other effects:
// soft blurred wisps drift UP from near the bottom of the hero, swaying
// and dissipating (growing, fading out) as they rise. One transform-only
// keyframe per element (translate + scale together), no wrap/inner split
// needed since nothing else animates `transform` on the same element.
// ---------------------------------------------------------------------------
export interface SteamWisp {
  style: CSSProperties;
}

export function risingSteam(count: number): SteamWisp[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 4.1 + 41);
    const b = rand(i * 6.7 + 42);
    const c = rand(i * 5.5 + 43);
    const d = rand(i * 3.3 + 44);
    return {
      style: {
        "--x": `${(a * 90 + 5).toFixed(1)}%`,
        "--size": `${(40 + b * 60).toFixed(0)}px`,
        "--peak-o": (0.18 + c * 0.22).toFixed(2),
        "--drift": `${(8 + b * 16).toFixed(0)}px`,
        "--rise-dur": `${(7 + a * 6).toFixed(1)}s`,
        "--rise-delay": `-${(d * 13).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}

// ---------------------------------------------------------------------------
// City bokeh lights — soft glowing dots scattered across the whole hero
// (not just falling from the top), each independently twinkling (opacity)
// and very slowly drifting (transform) — two separate animations on one
// element is fine here since they target different CSS properties, unlike
// the fall+flutter/fall+sway pairs above which both need `transform`.
// ---------------------------------------------------------------------------
const BOKEH_COLORS = ["#f0bd3e", "#ffe3c2", "#f6b9c6", "#fff6e0"];

export interface BokehLight {
  style: CSSProperties;
  color: string;
}

export function bokehLights(count: number): BokehLight[] {
  return Array.from({ length: count }, (_, i) => {
    const a = rand(i * 3.9 + 51);
    const b = rand(i * 7.3 + 52);
    const c = rand(i * 5.7 + 53);
    const d = rand(i * 2.3 + 54);
    const e = rand(i * 9.1 + 55);
    const f = rand(i * 4.7 + 56);
    const g = rand(i * 1.7 + 57);
    return {
      color: pick(BOKEH_COLORS, e),
      style: {
        "--x": `${(a * 96 + 2).toFixed(1)}%`,
        "--y": `${(b * 90 + 3).toFixed(1)}%`,
        "--size": `${(10 + c * 34).toFixed(0)}px`,
        "--o-min": (0.1 + d * 0.15).toFixed(2),
        "--o-max": (0.4 + d * 0.35).toFixed(2),
        "--dx": `${(f * 24 - 12).toFixed(0)}px`,
        "--dy": `${(g * 24 - 12).toFixed(0)}px`,
        "--drift-dur": `${(8 + a * 10).toFixed(1)}s`,
        "--drift-delay": `-${(b * 15).toFixed(1)}s`,
        "--twinkle-dur": `${(3 + c * 4).toFixed(1)}s`,
        "--twinkle-delay": `-${(d * 6).toFixed(1)}s`,
      } as CSSProperties,
    };
  });
}
