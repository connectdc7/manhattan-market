-- Manhattan Market — refunds from the dashboard (run once; safe to re-run)
--
-- Records refunds done with the dashboard's Refund button (owner only —
-- see app/api/orders/refund). refunded_items is a list of {id, qty} so a
-- second partial refund can't refund the same item twice.
alter table orders add column if not exists refunded_amount numeric(10, 2) not null default 0;
alter table orders add column if not exists refunded_items jsonb not null default '[]'::jsonb;
alter table orders add column if not exists refund_status text; -- null | 'partial' | 'full'
alter table orders add column if not exists refunded_at timestamptz;
