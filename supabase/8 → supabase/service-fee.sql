-- Manhattan Market — delivery service fee setting (run once; safe to re-run)
--
-- One row of store-wide settings. The owner changes the delivery service
-- fee from the dashboard (Settings tab); checkout adds it as its own line
-- on delivery orders. Everyone can read it (checkout needs it), only
-- owners can change it.
create table if not exists store_settings (
  id text primary key default 'singleton',
  delivery_service_fee numeric(10, 2) not null default 0
    check (delivery_service_fee >= 0 and delivery_service_fee <= 20),
  updated_at timestamptz not null default now()
);

insert into store_settings (id) values ('singleton') on conflict (id) do nothing;

alter table store_settings enable row level security;

drop policy if exists "Public can read store settings" on store_settings;
create policy "Public can read store settings"
  on store_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Owners can update store settings" on store_settings;
create policy "Owners can update store settings"
  on store_settings for update
  to authenticated
  using (is_owner())
  with check (is_owner());

-- What the customer paid as a service fee on each delivery order.
alter table orders add column if not exists service_fee numeric(10, 2);
