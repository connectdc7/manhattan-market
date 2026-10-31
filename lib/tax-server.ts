// Server-side tax math for checkout — shared by the checkout session (what
// the customer is actually charged) and /api/checkout/tax (the estimate on
// the checkout page), so the two always agree.
import { supabase } from "./supabase";
import { cleanRates, lineTaxCents, ratesFor, TaxRate } from "./tax";
import { discountLines } from "./welcome-offer";

export async function getDefaultTaxRates(): Promise<TaxRate[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("store_settings").select("default_tax_rates").eq("id", "singleton").maybeSingle();
  if (error || !data) return [];
  return cleanRates((data as { default_tax_rates?: unknown }).default_tax_rates);
}

export type TaxableLine = { name: string; priceCents: number; qty: number; taxRates: TaxRate[] };

// Item lines with their tax rates, the welcome discount taken off item
// prices (the same way Clover's checkout gets it), and the tax on top.
export function taxLines(
  items: { name: string; priceCents: number; qty: number; productRates: TaxRate[] | null | undefined }[],
  defaults: TaxRate[],
  discountCents: number
): { lines: TaxableLine[]; taxCents: number } {
  const base: TaxableLine[] = items.map((i) => ({
    name: i.name,
    priceCents: i.priceCents,
    qty: i.qty,
    taxRates: ratesFor(i.productRates, defaults),
  }));
  const lines = discountCents > 0 ? discountLines(base, discountCents) : base;
  const taxCents = lines.reduce((sum, l) => sum + lineTaxCents(l.priceCents * l.qty, l.taxRates), 0);
  return { lines, taxCents };
}
