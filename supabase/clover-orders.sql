-- Manhattan Market — website orders → Clover (run once; safe to re-run)
--
-- Remembers which Clover order each website order became, so an order is
-- never sent to Clover twice, and keeps the last error (if any) so the
-- dashboard can show it next to a "Send to Clover" button.
alter table orders add column if not exists clover_order_id text;
alter table orders add column if not exists clover_push_error text;
