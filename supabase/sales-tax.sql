-- DC sales tax on online orders (matches the Clover register):
-- products.tax_rates  = the item's own Clover tax rates (null = store default)
-- store_settings.default_tax_rates = Clover's default rates (saved on each sync)
-- orders.tax_amount   = tax the customer paid on that order
alter table public.products add column if not exists tax_rates jsonb;
alter table public.store_settings add column if not exists default_tax_rates jsonb;
alter table public.orders add column if not exists tax_amount numeric(10,2);
