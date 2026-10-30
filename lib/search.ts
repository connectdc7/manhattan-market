// Store search scoring, shared by the Order page (in the browser) and the
// out-of-stock lookup (server). No imports — safe on both sides.
//
// "water" should find Fiji Water and Deer Park Spring Water before
// Watermelon candy: a whole-word match scores highest, a word that starts
// with the search a little, anything else containing it least, and a
// matching department (e.g. "Water/Electrolytes") adds a boost. Every
// searched word has to match somewhere, so "coconut water" means both.

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

// Simple singular form, so "waters", "chips"→"chip", "batteries"→"battery".
function singular(w: string): string {
  if (w.length > 4 && w.endsWith("ies")) return `${w.slice(0, -3)}y`;
  if (w.length > 3 && w.endsWith("es") && /(ch|sh|x|ss|z)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
  return w;
}

export function searchWords(query: string): string[] {
  return norm(query)
    .split(" ")
    .filter((w) => w.length > 0)
    .map(singular);
}

function wordScore(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    const sw = singular(w);
    if (sw === q || w === q) return 3;
    if (w.startsWith(q)) best = Math.max(best, q.length >= 3 ? 1.2 : 0.6);
    else if (w.includes(q) && q.length >= 3) best = Math.max(best, 0.5);
  }
  return best;
}

// 0 = no match. Higher = better.
export function scoreProduct(queryWords: string[], name: string, category: string): number {
  if (queryWords.length === 0) return 1;
  const nameWords = norm(name).split(" ");
  const catWords = norm(category).split(" ");
  let total = 0;
  for (const q of queryWords) {
    const n = wordScore(q, nameWords);
    const c = wordScore(q, catWords);
    if (n === 0 && c === 0) return 0; // every word must match
    total += n + (c >= 3 ? 1.5 : c > 0 ? 0.5 : 0);
  }
  // Shorter names win ties ("Fiji Water" over "Fiji Water Sparkling Lime 12-pack").
  return total + 1 / (nameWords.length + 2);
}

export function rankProducts<T extends { name: string; category: string }>(items: T[], query: string): T[] {
  const words = searchWords(query);
  if (words.length === 0) return items;
  return items
    .map((p) => ({ p, s: scoreProduct(words, p.name, p.category) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name))
    .map((x) => x.p);
}

// "Best matches" = every searched word appears as a whole word in the name
// (so "water" → Fiji Water, Smart Water; not Watermelon). "Related" = the
// rest that still match (partial words, or the department matches).
export function splitMatches<T extends { name: string; category: string }>(items: T[], query: string): { best: T[]; related: T[] } {
  const words = searchWords(query);
  const ranked = rankProducts(items, query);
  if (words.length === 0) return { best: ranked, related: [] };
  const best: T[] = [];
  const related: T[] = [];
  for (const p of ranked) {
    const nameWords = norm(p.name).split(" ").map(singular);
    (words.every((w) => nameWords.includes(w)) ? best : related).push(p);
  }
  return { best, related };
}
