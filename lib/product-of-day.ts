// Picks the homepage's "Product of the Day" — automatically, with no staff
// action required beyond ticking "Healthy Pick" on a product in the
// dashboard (see InventoryPanel.tsx / setProductHealthy).
//
// Eligibility is exactly what the feature is meant to promote: healthy,
// reasonably priced, and in stock. "Reasonably priced" is relative to the
// store's own catalog (at or below the average price across everything on
// the menu) rather than a hardcoded dollar figure, so it stays sensible as
// prices change. Among eligible products, the newest ones (by created_at)
// are favored — the feature exists partly to promote new arrivals — and the
// pick rotates once per store-local calendar day, deterministically: the
// same day always resolves to the same product (no randomness, no cron job,
// no stored "today's pick" row), which is what makes it "automatic."
import { Product } from "./products";
import { getStoreDateKey } from "./store-hours";

// How many of the newest eligible products the daily rotation picks among.
// Keeps the "new arrivals" promise (never surfaces a stale eligible item
// while a newer one is waiting) while still rotating day to day when
// there's more than one healthy, reasonably-priced item newly in stock.
const ROTATION_POOL_SIZE = 5;

// A small, stable string hash (djb2) — deterministic across server and
// client, and across restarts/redeploys, unlike Math.random() or anything
// seeded from Date.now(). Only needs to be well-distributed, not secure.
function hashString(input: string): number {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 33) ^ input.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function getEligibleProducts(products: Product[]): Product[] {
  const inStock = products.filter((p) => p.stock > 0);
  if (inStock.length === 0) return [];

  const avgPrice = inStock.reduce((sum, p) => sum + p.price, 0) / inStock.length;

  return inStock.filter((p) => p.is_healthy && p.price <= avgPrice);
}

export function getProductOfTheDay(products: Product[], now: Date = new Date()): Product | null {
  const eligible = getEligibleProducts(products);
  if (eligible.length === 0) return null;

  const pool = [...eligible]
    .sort((a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime())
    .slice(0, ROTATION_POOL_SIZE);

  const dateKey = getStoreDateKey(now);
  const index = hashString(dateKey) % pool.length;
  return pool[index];
}

// True when a product was added recently enough to still call it "new" in
// the UI (a stamp badge on the homepage feature). Independent of whether it
// won the day's rotation — just a display detail.
const NEW_WINDOW_DAYS = 14;

export function isNewProduct(product: Product, now: Date = new Date()): boolean {
  if (!product.created_at) return false;
  const daysAgo = (now.getTime() - new Date(product.created_at).getTime()) / 86_400_000;
  return daysAgo >= 0 && daysAgo <= NEW_WINDOW_DAYS;
}
