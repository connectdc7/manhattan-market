// Sales stats for the dashboard, straight from Clover — every sale rung up
// on the store's register, plus website orders sent to Clover — instead of
// counting only the website's own orders table. Server-only (uses the
// Clover token). Used by app/api/clover/stats.
//
// Clover API: GET /v3/merchants/{mId}/orders with createdTime filters and
// expand=lineItems. "Today" and "yesterday" are store days in Washington,
// DC time, not the server's UTC.
import { cloverUrls, getFreshCloverConnection } from "./clover";

const STORE_TZ = "America/New_York";
const HISTORY_DAYS = 7; // best sellers + busiest hours look back this far

type CloverLineItem = { name?: string; price?: number; unitQty?: number; refunded?: boolean; exchanged?: boolean };
type CloverOrder = {
  id: string;
  note?: string;
  currency?: string;
  createdTime?: number;
  total?: number;
  state?: string;
  paymentState?: string;
  title?: string;
  lineItems?: { elements?: CloverLineItem[] };
};

export type CloverSale = {
  id: string;
  time: string; // ISO
  total: number;
  source: "online" | "register";
  title: string | null;
  note: string | null;
  items: { name: string; qty: number; price: number; refunded: boolean }[];
};

export type CloverStats = {
  todaysSales: CloverSale[]; // newest first — what the Sales/Orders Today tiles drop down to
  salesToday: number;
  salesYesterday: number;
  ordersToday: number;
  ordersYesterday: number;
  countByHour: number[]; // last HISTORY_DAYS days, store time
  bestSellers: { name: string; qty: number; revenue: number }[];
  slowMovers: { name: string; qty: number; revenue: number }[];
  ordersInHistory: number;
  historyDays: number;
  generatedAt: string;
};

// --- Store-time helpers -------------------------------------------------

function storeParts(ms: number) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    hourCycle: "h23",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(ms));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return { y: get("year"), m: get("month"), d: get("day"), h: get("hour") % 24, min: get("minute"), s: get("second") };
}

// UTC milliseconds of midnight (store time), `daysAgo` days before today.
function storeMidnight(daysAgo: number): number {
  const now = Date.now();
  const p = storeParts(now);
  const offset = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(now / 1000) * 1000; // store time − UTC
  return Date.UTC(p.y, p.m - 1, p.d - daysAgo) - offset;
}

// --- Clover fetch -------------------------------------------------------

async function fetchOrdersSince(merchantId: string, token: string, sinceMs: number): Promise<CloverOrder[]> {
  const out: CloverOrder[] = [];
  const limit = 1000;
  for (let offset = 0; offset < 50_000; offset += limit) {
    const url =
      `${cloverUrls().api}/v3/merchants/${merchantId}/orders` +
      `?filter=createdTime>=${sinceMs}&expand=lineItems&orderBy=createdTime%20DESC&limit=${limit}&offset=${offset}`;
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    for (let attempt = 0; res.status === 429 && attempt < 5; attempt++) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("[clover stats] orders fetch failed", { status: res.status, detail: detail.slice(0, 300) });
      throw new Error(
        `Clover refused the order list (HTTP ${res.status})${res.status === 401 || res.status === 403 ? " — the API token needs the Orders Read permission" : ""}.`
      );
    }
    const body = (await res.json()) as { elements?: CloverOrder[] };
    const page = body.elements ?? [];
    out.push(...page);
    if (page.length < limit) break;
  }
  return out;
}

// A sale counts once it's paid on the register — or, for website orders
// sent to Clover (titled "WEB #…"), once it exists (it was paid online).
function counts(o: CloverOrder): boolean {
  if (o.title?.startsWith("WEB #")) return true;
  const paid = (o.paymentState ?? "").toUpperCase() === "PAID" || (o.state ?? "").toLowerCase() === "locked";
  return paid && (o.state ?? "").toLowerCase() !== "deleted";
}

function lineQty(li: CloverLineItem): number {
  // unitQty is in thousandths for items sold by weight/quantity; whole units otherwise.
  return typeof li.unitQty === "number" && li.unitQty > 0 ? Math.max(1, Math.round(li.unitQty / 1000)) : 1;
}

function orderTotal(o: CloverOrder): number {
  if (typeof o.total === "number" && o.total > 0) return o.total / 100;
  const items = o.lineItems?.elements ?? [];
  return items.filter((li) => !li.refunded).reduce((s, li) => s + (li.price ?? 0) * lineQty(li), 0) / 100;
}

// --- Public -------------------------------------------------------------

let cache: { at: number; stats: CloverStats } | null = null;
const CACHE_MS = 2 * 60_000; // be gentle with Clover's rate limits

export async function getCloverStats(): Promise<CloverStats> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stats;

  const connection = await getFreshCloverConnection();
  if (!connection) throw new Error("Clover isn't connected.");

  const todayStart = storeMidnight(0);
  const yesterdayStart = storeMidnight(1);
  const historyStart = storeMidnight(HISTORY_DAYS - 1);

  const orders = (await fetchOrdersSince(connection.merchant_id, connection.access_token, historyStart)).filter(counts);

  let salesToday = 0;
  let salesYesterday = 0;
  let ordersToday = 0;
  let ordersYesterday = 0;
  const countByHour = new Array(24).fill(0);
  const todaysSales: CloverSale[] = [];
  const qty = new Map<string, number>();
  const revenue = new Map<string, number>();

  for (const o of orders) {
    const t = o.createdTime ?? 0;
    const total = orderTotal(o);
    if (t >= todayStart) {
      salesToday += total;
      ordersToday++;
      todaysSales.push({
        id: o.id,
        time: new Date(t).toISOString(),
        total: Math.round(total * 100) / 100,
        source: o.title?.startsWith("WEB #") ? "online" : "register",
        title: o.title?.trim() || null,
        note: o.note?.trim() || null,
        items: (o.lineItems?.elements ?? []).map((li) => ({
          name: li.name?.trim() || "Item",
          qty: lineQty(li),
          price: (li.price ?? 0) / 100,
          refunded: Boolean(li.refunded),
        })),
      });
    } else if (t >= yesterdayStart) {
      salesYesterday += total;
      ordersYesterday++;
    }
    countByHour[storeParts(t).h]++;

    for (const li of o.lineItems?.elements ?? []) {
      if (li.refunded || li.exchanged || !li.name) continue;
      const n = li.name.trim();
      const q = lineQty(li);
      qty.set(n, (qty.get(n) ?? 0) + q);
      revenue.set(n, (revenue.get(n) ?? 0) + ((li.price ?? 0) * q) / 100);
    }
  }

  const ranked = [...qty.entries()]
    .map(([name, q]) => ({ name, qty: q, revenue: Math.round((revenue.get(name) ?? 0) * 100) / 100 }))
    .sort((a, b) => b.qty - a.qty);

  todaysSales.sort((a, b) => b.time.localeCompare(a.time));

  const stats: CloverStats = {
    todaysSales,
    salesToday: Math.round(salesToday * 100) / 100,
    salesYesterday: Math.round(salesYesterday * 100) / 100,
    ordersToday,
    ordersYesterday,
    countByHour,
    bestSellers: ranked.slice(0, 10),
    slowMovers: ranked.length > 10 ? ranked.slice(-5).reverse() : [],
    ordersInHistory: orders.length,
    historyDays: HISTORY_DAYS,
    generatedAt: new Date().toISOString(),
  };
  cache = { at: Date.now(), stats };
  return stats;
}
