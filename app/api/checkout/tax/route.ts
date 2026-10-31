// The sales-tax line on the checkout page — worked out here the same way the
// checkout session charges it (lib/tax-server.ts), from server-side prices
// and each item's Clover tax rates. The browser only sends ids and quantities.
import { NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/products";
import { getDefaultTaxRates, taxLines } from "@/lib/tax-server";

export async function POST(request: Request) {
  let body: { items?: { id: string; qty: number }[]; discountCents?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request." }, { status: 400 });
  }
  const lines = (body.items ?? []).filter((l) => l && typeof l.id === "string" && Number(l.qty) > 0).slice(0, 200);
  if (lines.length === 0) return NextResponse.json({ taxCents: 0 });
  const products = await getProductsByIds(lines.map((l) => l.id));
  const items = lines
    .map((l) => {
      const p = products.find((x) => x.id === l.id);
      return p ? { name: p.name, priceCents: Math.round(p.price * 100), qty: Math.floor(Number(l.qty)), productRates: p.tax_rates } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  const discount = Math.max(0, Math.min(Math.floor(Number(body.discountCents) || 0), 100_00));
  const { taxCents } = taxLines(items, await getDefaultTaxRates(), discount);
  return NextResponse.json({ taxCents });
}
