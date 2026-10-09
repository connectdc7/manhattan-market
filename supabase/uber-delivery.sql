-- Manhattan Market — Uber delivery (run once; safe to re-run)
--
-- Where a delivery order is going, what the customer paid for delivery,
-- and the Uber courier's status, kept on the order itself. Customers can
-- already insert orders (that policy is unchanged); only staff can read
-- them, so these addresses/phones are staff-only like the rest of orders.
alter table orders add column if not exists delivery_address jsonb;
alter table orders add column if not exists delivery_fee numeric(10, 2);
alter table orders add column if not exists uber_delivery_id text;
alter table orders add column if not exists uber_status text;
alter table orders add column if not exists uber_tracking_url text;
alter table orders add column if not exists uber_courier jsonb;
alter table orders add column if not exists uber_error text;

create index if not exists orders_uber_delivery_id_idx on orders (uber_delivery_id);
