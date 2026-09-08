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

alter table products enable row level security;

drop policy if exists "Public can read products" on products;
create policy "Public can read products"
  on products for select
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

-- Anyone can sign up (insert), but nobody can read the list back through
-- the public API — you'll view signups from the Supabase table editor
-- instead, not through the website.
drop policy if exists "Public can join rewards" on rewards_signups;
create policy "Public can join rewards"
  on rewards_signups for insert
  to anon
  with check (true);
