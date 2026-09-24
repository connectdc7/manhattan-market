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
-- categories — the department list products.category is drawn from. Starts
-- with the same four departments this build always had (seeded below), but
-- isn't locked to just those: Clover sync creates a new row here the first
-- time it sees a department name it doesn't recognize (see lib/clover.ts's
-- resolveCloverCategory), flagged needs_review = true and
-- show_on_storefront = false until a staffer confirms/renames/merges/shows
-- it from the dashboard's Inventory tab. Defined before `products` below
-- since products.category is a foreign key into this table.
-- ---------------------------------------------------------------------------
create table if not exists categories (
  name text primary key,
  sort_order integer not null default 0,
  show_on_storefront boolean not null default true,
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

drop policy if exists "Public can read categories" on categories;
create policy "Public can read categories"
  on categories for select
  to anon
  using (true);

-- Lets the dashboard's Inventory tab rename, hide/show, or hand-add a
-- category without a login. Same no-login tradeoff noted at the top of
-- this file. No delete policy on purpose — removing a category only ever
-- happens through merge_category() below, which runs as the function
-- owner (security definer) and does the delete itself after moving that
-- category's products somewhere else, so a direct anon delete can't leave
-- products pointed at a category that no longer exists.
drop policy if exists "Public can add categories" on categories;
create policy "Public can add categories"
  on categories for insert
  to anon
  with check (true);

drop policy if exists "Public can update categories" on categories;
create policy "Public can update categories"
  on categories for update
  to anon
  using (true)
  with check (true);

insert into categories (name, sort_order, show_on_storefront, needs_review) values
  ('Hot Food', 0, true, false),
  ('Snacks', 1, true, false),
  ('Drinks', 2, true, false),
  ('Grocery', 3, true, false)
on conflict (name) do nothing;

-- Remembers which raw Clover department name maps to which row above, so
-- renaming or merging a category here doesn't make the next Clover sync
-- think that department is "new" again (it would otherwise recreate the
-- old name under a fresh row — see resolveCloverCategory's comment in
-- lib/clover.ts). Server-only, like clover_connections further down:
-- nothing in the browser reads or writes this table directly, so it gets
-- no anon policies at all.
create table if not exists category_aliases (
  clover_name text primary key,
  category_name text not null references categories (name) on update cascade on delete cascade,
  created_at timestamptz not null default now()
);

alter table category_aliases enable row level security;

-- Atomically folds one category into another — moves every product and
-- repoints every Clover alias from p_from to p_into, then removes the
-- now-empty p_from row. Used by the dashboard's "merge into" action (see
-- lib/categories.ts's mergeCategoryInto) instead of three separate writes
-- from the browser, where a dropped connection partway through could leave
-- products pointed at a category that no longer exists. Mirrors the
-- decrement_stock function below in spirit — the read-then-write-from-the-
-- browser risk, just for a rename/merge instead of a stock count.
create or replace function merge_category(p_from text, p_into text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_from = p_into then
    return;
  end if;
  update products set category = p_into where category = p_from;
  update category_aliases set category_name = p_into where category_name = p_from;
  delete from categories where name = p_from;
end;
$$;

grant execute on function merge_category(text, text) to anon;

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------
create table if not exists products (
  id text primary key,
  name text not null,
  category text not null references categories (name) on update cascade,
  price numeric(10, 2) not null,
  stock integer not null default 0 check (stock >= 0),
  blurb text not null default '',
  swatch text not null default '#21594a'
);

-- Upgrades a table created before categories existed, where `category` was
-- just a free-text column locked to the original four names by a CHECK
-- constraint. Safe to re-run: both guards no-op once already applied.
alter table products drop constraint if exists products_category_check;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'products_category_fkey') then
    alter table products add constraint products_category_fkey
      foreign key (category) references categories (name) on update cascade;
  end if;
end $$;

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
-- gallery_images — one row per tile on the public Gallery page
-- (app/gallery/page.tsx: Storefront, Hot food counter, Snack aisle, Coffee
-- station, Drink cooler, Register). image_url starts empty, same as a
-- product with no photo, and the page falls back to that tile's plain
-- color block until it's filled in — either by the dashboard's "Generate
-- gallery photos" button (an AI-generated placeholder scene, see
-- lib/image-gen.ts) or, later, a real photo of the actual store.
-- ---------------------------------------------------------------------------
create table if not exists gallery_images (
  key text primary key,
  image_url text not null default ''
);

insert into gallery_images (key, image_url) values
  ('storefront', ''),
  ('hot-food-counter', ''),
  ('snack-aisle', ''),
  ('coffee-station', ''),
  ('drink-cooler', ''),
  ('register', '')
on conflict (key) do nothing;

alter table gallery_images enable row level security;

drop policy if exists "Public can read gallery images" on gallery_images;
create policy "Public can read gallery images"
  on gallery_images for select
  to anon
  using (true);

-- No public write policy here on purpose — unlike products, nothing in the
-- browser ever writes to this table. Only the dashboard's "Generate
-- gallery photos" button does, through /api/gallery/generate-photos, which
-- uses the service-role key (see lib/supabase-admin.ts), not the anon key.

-- ---------------------------------------------------------------------------
-- hero_settings / hero_media — lets staff swap the homepage hero's
-- background from the dashboard's Homepage tab: one of the built-in
-- ambient effects (Pink Petals, Falling Snow, Golden Autumn Leaves, Warm
-- Coffee Steam, City Bokeh Lights), their own uploaded photo(s)/video, or a
-- plain background with none of the above. hero_settings is a singleton
-- row (same pattern as clover_webhook_state above); hero_media is the
-- uploaded photo/video library, of which at most one is ever "active" (the
-- one actually shown when effect = 'custom') — see set_active_hero_media()
-- below. Defaults to 'petals' so an existing site's homepage looks exactly
-- the same as before this table existed, until staff actively change it.
-- ---------------------------------------------------------------------------
create table if not exists hero_settings (
  id text primary key default 'singleton',
  effect text not null default 'petals'
    check (effect in ('petals', 'snow', 'leaves', 'steam', 'bokeh', 'custom', 'plain')),
  updated_at timestamptz not null default now()
);

insert into hero_settings (id, effect) values ('singleton', 'petals')
on conflict (id) do nothing;

alter table hero_settings enable row level security;

drop policy if exists "Public can read hero settings" on hero_settings;
create policy "Public can read hero settings"
  on hero_settings for select
  to anon
  using (true);

-- Lets the dashboard's Homepage tab change the hero effect without a
-- login. Same no-login tradeoff noted at the top of this file.
drop policy if exists "Public can update hero settings" on hero_settings;
create policy "Public can update hero settings"
  on hero_settings for update
  to anon
  using (true)
  with check (true);

create table if not exists hero_media (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('photo', 'video')),
  url text not null,
  -- The storage object's own path (distinct from `url`, its public URL) —
  -- kept so deleting a row can also remove the underlying file with a
  -- direct storage call, instead of having to parse a path back out of a
  -- public URL.
  storage_path text not null,
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table hero_media enable row level security;

drop policy if exists "Public can read hero media" on hero_media;
create policy "Public can read hero media"
  on hero_media for select
  to anon
  using (true);

drop policy if exists "Public can add hero media" on hero_media;
create policy "Public can add hero media"
  on hero_media for insert
  to anon
  with check (true);

drop policy if exists "Public can update hero media" on hero_media;
create policy "Public can update hero media"
  on hero_media for update
  to anon
  using (true)
  with check (true);

drop policy if exists "Public can delete hero media" on hero_media;
create policy "Public can delete hero media"
  on hero_media for delete
  to anon
  using (true);

-- Marks exactly one hero_media row active in a single statement, instead
-- of an unset-everything-then-set-one pair of writes from the browser,
-- where a dropped connection between the two could briefly leave zero (or
-- two) rows active. Mirrors merge_category's reasoning above.
create or replace function set_active_hero_media(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update hero_media set is_active = (id = p_id);
$$;

grant execute on function set_active_hero_media(uuid) to anon;

-- ---------------------------------------------------------------------------
-- product-photos (storage) — lets staff upload a real product photo from
-- the dashboard (a phone camera roll or a saved file), instead of typing
-- in an image URL, and also holds AI-generated gallery scene photos (under
-- a gallery/ prefix) — one shared public bucket for both. The bucket is
-- public so photos display on the site without a login; the policies
-- below only affect who can upload/replace them, not who can view them.
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
-- hero-media (storage) — the client's own uploaded homepage hero
-- photo(s)/video, staged from the dashboard's Homepage tab (a phone camera
-- roll works directly, same as product photos). Separate bucket from
-- product-photos since a hero video can run much bigger than a product
-- shot. Public so the homepage can display them without a login; the
-- policies below only affect who can upload/remove them. Capped at 60MB
-- per file — mainly a guard on video uploads; a hero background loop
-- should be a few seconds, not a full-length clip.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('hero-media', 'hero-media', true, 62914560)
on conflict (id) do nothing;

drop policy if exists "Public can read hero media files" on storage.objects;
create policy "Public can read hero media files"
  on storage.objects for select
  to anon
  using (bucket_id = 'hero-media');

drop policy if exists "Public can upload hero media files" on storage.objects;
create policy "Public can upload hero media files"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'hero-media');

drop policy if exists "Public can delete hero media files" on storage.objects;
create policy "Public can delete hero media files"
  on storage.objects for delete
  to anon
  using (bucket_id = 'hero-media');

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

  -- So a category Clover's sync creates mid-session (flagged needs_review)
  -- shows up in the dashboard's review queue without a manual refresh.
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'categories'
  ) then
    alter publication supabase_realtime add table categories;
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

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hero_settings'
  ) then
    alter publication supabase_realtime add table hero_settings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hero_media'
  ) then
    alter publication supabase_realtime add table hero_media;
  end if;
end $$;
