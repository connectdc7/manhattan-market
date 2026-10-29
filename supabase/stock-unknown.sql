-- Manhattan Market — items Clover doesn't keep a count for (run once; safe to re-run).
-- stock_unknown = Clover has no stock count for the item, or its count has
-- gone below zero (sold more than was ever counted in). Those items are
-- treated as available on the website instead of "0 in stock".
-- clover_quantity = Clover's raw count (can be negative), for reference.
alter table products add column if not exists stock_unknown boolean not null default false;
alter table products add column if not exists clover_quantity numeric;
create index if not exists products_stock_unknown_idx on products (stock_unknown) where stock_unknown;
