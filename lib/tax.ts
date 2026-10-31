// Sales tax for online orders, matching what the Clover register charges.
// Each product carries the tax rates Clover has on that item (synced in
// lib/clover-sync.ts); items set to Clover's "default tax" use the store's
// default rates. Rates use Clover's units: 10% = 1,000,000.
export type TaxRate = { name: string; rate: number };

// null on a product = "use the store's default rates"; [] = not taxed.
export function ratesFor(productRates: TaxRate[] | null | undefined, defaults: TaxRate[]): TaxRate[] {
  return Array.isArray(productRates) ? productRates : defaults;
}

export function lineTaxCents(amountCents: number, rates: TaxRate[]): number {
  const total = rates.reduce((sum, r) => sum + (Number(r.rate) || 0), 0);
  return Math.round((amountCents * total) / 10_000_000);
}

// Clover tax-rate objects → our shape (drops anything malformed).
export function cleanRates(raw: unknown): TaxRate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({ name: String((r as TaxRate)?.name ?? "Tax").slice(0, 60), rate: Number((r as TaxRate)?.rate) }))
    .filter((r) => Number.isFinite(r.rate) && r.rate > 0);
}
