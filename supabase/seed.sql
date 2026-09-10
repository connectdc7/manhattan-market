-- Manhattan Market — Supabase setup for the preview build.
--
-- Run this once in your Supabase project's SQL Editor (Project > SQL Editor
-- > New query > paste this whole file > Run). It creates the two tables the
-- demo reads/writes, locks them down with Row Level Security, and seeds the
-- same 12 sample products already in the code — so the site keeps looking
-- and behaving the same, just backed by a real database now.
--
-- Nothing here is Manhattan Market's real inventory yet. When you get real
-- products, hours, and stock counts from your friend, this table is what
-- gets updated (by hand for now, later synced automatically from Clover).
--
-- Heads up on the employee dashboard (/dashboard): it was built unlisted
-- with no login, to keep the demo quick to set up. To make that work, the
-- policies below let anyone holding the public "anon" key — which ships in
-- the site's own JavaScript, so effectively anyone — read rewards signups
-- and orders, and add, edit, delete, or photograph products, not just view
-- them. That's an acceptable tradeoff for placeholder demo data, but before
-- this goes live with real customer phone numbers/emails, put a real login
-- (e.g. Supabase Auth) in front of /dashboard and tighten these policies to
-- require it.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id text primary key,
  name text not null,
  category text not null check (category in ('Hot Food', 'Snacks', 'Drinks', 'Grocery')),
  price numeric(10, 2) not null,
  stock integer not null default 0 check (stock >= 0),
  blurb text not null default '',
  swatch text not null default '#21594a'
);

-- Real product photo, uploaded from the dashboard (see the storage bucket
-- below). Empty string until staff add one, and the site falls back to the
-- `swatch` color tile until then. Added as a separate statement so this
-- file stays safe to re-run on a table that predates this column.
alter table products add column if not exists image_url text not null default '';

alter table products enable row level security;

drop policy if exists "Public can read products" on products;
create policy "Public can read products"
  on products for select
  to anon
  using (true);

-- Lets the employee dashboard (/dashboard) edit stock counts, product
-- details, and photos directly from the browser, since that page has no
-- login yet. See the note at the top of this file about what that
-- tradeoff means.
drop policy if exists "Public can update products" on products;
create policy "Public can update products"
  on products for update
  to anon
  using (true)
  with check (true);

-- Lets staff add a brand-new item to the menu from the dashboard.
drop policy if exists "Public can add products" on products;
create policy "Public can add products"
  on products for insert
  to anon
  with check (true);

-- Lets staff remove a product they added by mistake, or one Manhattan
-- Market no longer carries.
drop policy if exists "Public can delete products" on products;
create policy "Public can delete products"
  on products for delete
  to anon
  using (true);

-- Atomic stock decrement, called from checkout. Doing the subtraction in
-- the database (instead of read-then-write from the browser) avoids the
-- same race condition that matters for the real Clover sync: two orders
-- for the last item landing at once. Never goes below zero.
create or replace function decrement_stock(p_product_id text, p_qty integer)
returns void
language sql
security definer
set search_path = public
as $$
  update products
  set stock = greatest(stock - p_qty, 0)
  where id = p_product_id;
$$;

grant execute on function decrement_stock(text, integer) to anon;

-- Seed data — mirrors lib/products.ts's fallback catalog exactly, so
-- switching Supabase on doesn't change what's on the menu.
insert into products (id, name, category, price, stock, blurb, swatch) values
  ('hot-coffee', 'Fresh Brewed Coffee', 'Hot Food', 2.25, 24, 'Hot, ready, and refilled all day.', '#6b4226'),
  ('bacon-egg-sandwich', 'Bacon, Egg & Cheese', 'Hot Food', 5.50, 9, 'Made fresh at the counter every morning.', '#c98b3a'),
  ('chicken-empanada', 'Chicken Empanada', 'Hot Food', 3.25, 14, 'Two in a bag, always warm.', '#d97b3f'),
  ('chips-classic', 'Classic Potato Chips', 'Snacks', 2.00, 31, 'The everyday bag by the register.', '#e0a938'),
  ('chocolate-bar', 'Chocolate Bar', 'Snacks', 1.75, 42, 'Impulse-buy shelf favorite.', '#5a3825'),
  ('trail-mix', 'Trail Mix', 'Snacks', 3.50, 6, 'Nuts, raisins, chocolate chips.', '#8a6a3f'),
  ('cold-brew', 'Bottled Cold Brew', 'Drinks', 3.75, 18, 'Straight from the cooler.', '#3a2a1e'),
  ('orange-juice', 'Orange Juice, 16oz', 'Drinks', 2.50, 22, 'Squeezed, not from concentrate.', '#e8912a'),
  ('sparkling-water', 'Sparkling Water', 'Drinks', 1.50, 2, 'Almost out — restocking Thursday.', '#7fa6a3'),
  ('energy-drink', 'Energy Drink', 'Drinks', 3.00, 27, 'The one everyone grabs before work.', '#3e6b4a'),
  ('milk-half-gallon', 'Milk, Half Gallon', 'Grocery', 3.25, 11, 'Whole, 2%, and skim in the cooler.', '#e8e4d8'),
  ('bread-loaf', 'White Bread Loaf', 'Grocery', 3.00, 8, 'Fresh delivery every other day.', '#d9b978')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- rewards_signups
-- ---------------------------------------------------------------------------
create table if not exists rewards_signups (
  id uuid primary key default gen_random_uuid(),
  contact text not null,
  created_at timestamptz not null default now()
);

alter table rewards_signups enable row level security;

drop policy if exists "Public can join rewards" on rewards_signups;
create policy "Public can join rewards"
  on rewards_signups for insert
  to anon
  with check (true);

-- Lets the employee dashboard list signups without a login. See the note
-- at the top of this file about what that tradeoff means.
drop policy if exists "Public can read rewards signups" on rewards_signups;
create policy "Public can read rewards signups"
  on rewards_signups for select
  to anon
  using (true);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  fulfillment text not null check (fulfillment in ('pickup', 'delivery')),
  items jsonb not null,
  subtotal numeric(10, 2) not null
);

-- Order status, for the dashboard's kitchen/counter-style workflow (New ->
-- Preparing -> Ready -> Completed). Added with a separate statement + a
-- named constraint so this file stays safe to re-run on a table that
-- already existed before this column did.
alter table orders add column if not exists status text not null default 'new';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orders_status_check') then
    alter table orders add constraint orders_status_check
      check (status in ('new', 'preparing', 'ready', 'completed'));
  end if;
end $$;

alter table orders enable row level security;

drop policy if exists "Public can create orders" on orders;
create policy "Public can create orders"
  on orders for insert
  to anon
  with check (true);

-- Lets the employee dashboard list recent orders without a login. See the
-- note at the top of this file about what that tradeoff means.
drop policy if exists "Public can read orders" on orders;
create policy "Public can read orders"
  on orders for select
  to anon
  using (true);

-- Lets the dashboard advance an order's status (New -> Preparing -> Ready ->
-- Completed) without a login. Same tradeoff as above.
drop policy if exists "Public can update orders" on orders;
create policy "Public can update orders"
  on orders for update
  to anon
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- product-photos (storage) — lets staff upload a real product photo from
-- the dashboard (a phone camera roll or a saved file), instead of typing
-- in an image URL. The bucket is public so photos display on the site
-- without a login; the policies below only affect who can upload/replace
-- them, not who can view them.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "Public can read product photos" on storage.objects;
create policy "Public can read product photos"
  on storage.objects for select
  to anon
  using (bucket_id = 'product-photos');

-- Lets the dashboard upload/replace a product's photo without a login.
-- Same tradeoff noted at the top of this file.
drop policy if exists "Public can upload product photos" on storage.objects;
create policy "Public can upload product photos"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'product-photos');

drop policy if exists "Public can update product photos" on storage.objects;
create policy "Public can update product photos"
  on storage.objects for update
  to anon
  using (bucket_id = 'product-photos')
  with check (bucket_id = 'product-photos');

-- ---------------------------------------------------------------------------
-- Realtime — lets the dashboard update the moment an order comes in or
-- stock changes, instead of needing a manual refresh. Wrapped in existence
-- checks so this file stays safe to re-run.
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table products;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table orders;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rewards_signups'
  ) then
    alter publication supabase_realtime add table rewards_signups;
  end if;
end $$;
