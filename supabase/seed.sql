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
-- the site's own JavaScript, so effectively anyone — read rewards signups,
-- orders, and restock-notification requests, and add, edit, delete, or
-- photograph products, not just view them. That's an acceptable tradeoff for placeholder demo data, but before
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

-- Links a row to the Clover item it was synced from (see the Clover
-- section near the bottom of this file). Null for anything added by hand
-- from the dashboard instead of pulled from Clover. The partial unique
-- index (rather than a plain unique constraint) is what lets multiple
-- hand-added rows all have a null clover_item_id at once.
alter table products add column if not exists clover_item_id text;

drop index if exists products_clover_item_id_idx;
create unique index products_clover_item_id_idx
  on products (clover_item_id)
  where clover_item_id is not null;

-- Set the moment stock last went UP (a delivery came in, a correction), as
-- opposed to every stock change (which also happens on every sale). Powers
-- the homepage's "just restocked" strip. A trigger (below) keeps this
-- current automatically — nothing in the app code sets it directly.
alter table products add column if not exists restocked_at timestamptz;

-- Staff-controlled "Today's Special" flag, toggled from the dashboard's
-- Inventory tab. Shows a banner on the storefront when any product has it
-- set. Plain boolean, not tied to a discount — the price shown is still
-- whatever's in the price column.
alter table products add column if not exists is_special boolean not null default false;

-- Staff-controlled "Healthy Pick" flag, toggled from the dashboard's
-- Inventory tab. Feeds the homepage's "Product of the Day" section, which
-- rotates daily among healthy, reasonably-priced, newer products.
alter table products add column if not exists is_healthy boolean not null default false;

-- When the row was added. Defaults to now() for anything new going forward;
-- backfilled below (for the 12 seed rows only, and only if still at their
-- insert-time default) with staggered dates so the "newest first" half of
-- the Product of the Day pick has a real mix to work with in the demo.
alter table products add column if not exists created_at timestamptz not null default now();

create or replace function set_restocked_at()
returns trigger
language plpgsql
as $$
begin
  if new.stock > old.stock then
    new.restocked_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists products_set_restocked_at on products;
create trigger products_set_restocked_at
  before update on products
  for each row
  execute function set_restocked_at();

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

-- Demo defaults for the Healthy Pick flag and staggered created_at dates
-- (see the column comments above) — safe to re-run: each row only updates
-- if it's still sitting at the plain insert-time default, so it never
-- overwrites a real choice staff made from the dashboard afterward.
update products set is_healthy = true
  where id in ('trail-mix', 'orange-juice', 'sparkling-water', 'milk-half-gallon')
  and is_healthy = false;

update products set created_at = now() - interval '5 days'
  where id = 'trail-mix' and created_at::date = current_date;
update products set created_at = now() - interval '2 days'
  where id = 'orange-juice' and created_at::date = current_date;
update products set created_at = now() - interval '60 days'
  where id = 'sparkling-water' and created_at::date = current_date;
update products set created_at = now() - interval '90 days'
  where id = 'milk-half-gallon' and created_at::date = current_date;
update products set created_at = now() - interval '120 days'
  where id = 'chicken-empanada' and created_at::date = current_date;
update products set created_at = now() - interval '150 days'
  where id in ('cold-brew', 'bread-loaf') and created_at::date = current_date;
update products set created_at = now() - interval '180 days'
  where id in ('hot-coffee', 'bacon-egg-sandwich', 'chips-classic', 'chocolate-bar', 'energy-drink')
  and created_at::date = current_date;

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

-- Optional — a customer can leave a phone number at checkout to get a text
-- when their order's marked Ready. Null for anyone who skips it, or for
-- any order placed before this column existed. See the "Connecting SMS"
-- section of the README for turning the actual texting on.
alter table orders add column if not exists phone text;

-- Which Stripe Checkout session paid for this order — null for any order
-- placed before Stripe was connected (or via the mocked preview flow when
-- it isn't). The unique index is what makes the webhook safe to receive
-- twice: Stripe redelivers a webhook it didn't get a fast 200 for, and
-- without this a retry would silently create a second order (and
-- decrement stock twice) for the same payment. See lib/orders-admin.ts.
alter table orders add column if not exists stripe_session_id text;

create unique index if not exists orders_stripe_session_id_idx
  on orders (stripe_session_id)
  where stripe_session_id is not null;

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
-- restock_requests — "notify me when this is back" requests left on a
-- sold-out product. NO LONGER USED BY THE APP: the storefront now hides
-- out-of-stock products entirely instead of offering a notify-me signup, so
-- nothing reads or writes this table anymore. Left in place (rather than
-- dropped) so re-running this file stays harmless either way — safe to
-- ignore, or drop it yourself in the SQL Editor if you'd like it gone:
-- `drop table if exists restock_requests;`
-- ---------------------------------------------------------------------------
create table if not exists restock_requests (
  id uuid primary key default gen_random_uuid(),
  product_id text not null references products (id) on delete cascade,
  contact text not null,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

alter table restock_requests enable row level security;

drop policy if exists "Public can request restock notifications" on restock_requests;
create policy "Public can request restock notifications"
  on restock_requests for insert
  to anon
  with check (true);

drop policy if exists "Public can read restock requests" on restock_requests;
create policy "Public can read restock requests"
  on restock_requests for select
  to anon
  using (true);

drop policy if exists "Public can update restock requests" on restock_requests;
create policy "Public can update restock requests"
  on restock_requests for update
  to anon
  using (true)
  with check (true);

-- ---------------------------------------------------------------------------
-- Clover — the plumbing for syncing inventory from a real Clover account,
-- built ahead of actually having one. Inert until CLOVER_APP_ID and
-- CLOVER_APP_SECRET are set (see README's Clover section); nothing here
-- does anything on its own.
--
-- Unlike every other table in this file, these two are NOT readable or
-- writable by the anon key — no policies are granted to `anon` at all.
-- With Row Level Security on and zero policies, every anon/browser request
-- is denied by default; only the server-side API routes under
-- app/api/clover/**, using the Supabase *service role* key
-- (SUPABASE_SERVICE_ROLE_KEY, never shipped to the browser), can read or
-- write them. That's deliberate — clover_connections holds a real access
-- token to your friend's Clover account, which must never reach a page's
-- JavaScript the way the anon-accessible tables in this file do.
-- ---------------------------------------------------------------------------
create table if not exists clover_connections (
  merchant_id text primary key,
  access_token text not null,
  refresh_token text,
  access_token_expiration bigint,
  refresh_token_expiration bigint,
  connected_at timestamptz not null default now()
);

alter table clover_connections enable row level security;

create table if not exists clover_webhook_state (
  id text primary key default 'singleton',
  last_verification_code text,
  last_event_at timestamptz
);

alter table clover_webhook_state enable row level security;

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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'restock_requests'
  ) then
    alter publication supabase_realtime add table restock_requests;
  end if;
end $$;
