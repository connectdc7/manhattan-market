-- Manhattan Market — staff login (run once, AFTER seed.sql)
--
-- Paste this whole file into Supabase > SQL Editor > New query > Run.
-- Safe to re-run. seed.sql now ends with this same section, so re-running
-- seed.sql later also lands in this locked-down state.
--
-- What it does:
--   1. Adds a `staff` table: which Supabase Auth accounts are Manhattan
--      Market staff, and which of them are owners (owners can add/remove
--      staff from the dashboard's Staff tab).
--   2. Replaces every "anyone with the public key can write/read this"
--      policy the no-login dashboard relied on with "only signed-in staff".
--      Customer-facing actions (browsing the menu, placing an order, joining
--      rewards) still work for everyone.
--
-- Why a staff table instead of "any signed-in user": if Supabase's public
-- sign-up setting were ever left on, anyone could create an account and be
-- "signed in". Checking the staff list means an account only gets dashboard
-- access when an owner (or you, via SQL) put it there.
--
-- AFTER RUNNING THIS, make yourself the first owner — see the bottom of
-- this file.

-- ---------------------------------------------------------------------------
-- staff
-- ---------------------------------------------------------------------------
create table if not exists staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  name text,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  created_at timestamptz not null default now()
);

alter table staff enable row level security;

-- security definer so these can look at `staff` regardless of the caller's
-- own policies; they only ever answer "is the current caller staff/owner".
create or replace function is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where user_id = auth.uid());
$$;

create or replace function is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from staff where user_id = auth.uid() and role = 'owner');
$$;

grant execute on function is_staff() to anon, authenticated;
grant execute on function is_owner() to anon, authenticated;

-- Staff can see their own row (so the dashboard knows their role); owners
-- can see everyone. Adding/removing/changing staff only happens through the
-- server routes under app/api/staff (service role key), never directly.
drop policy if exists "Staff can read own staff row" on staff;
create policy "Staff can read own staff row"
  on staff for select
  to authenticated
  using (user_id = auth.uid() or is_owner());

-- ---------------------------------------------------------------------------
-- categories — public read; staff-only writes
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read categories" on categories;
create policy "Public can read categories"
  on categories for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can add categories" on categories;
drop policy if exists "Public can update categories" on categories;

drop policy if exists "Staff can add categories" on categories;
create policy "Staff can add categories"
  on categories for insert
  to authenticated
  with check (is_staff());

drop policy if exists "Staff can update categories" on categories;
create policy "Staff can update categories"
  on categories for update
  to authenticated
  using (is_staff())
  with check (is_staff());

create or replace function merge_category(p_from text, p_into text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only signed-in staff can merge categories';
  end if;
  if p_from = p_into then
    return;
  end if;
  update products set category = p_into where category = p_from;
  update category_aliases set category_name = p_into where category_name = p_from;
  delete from categories where name = p_from;
end;
$$;

revoke execute on function merge_category(text, text) from public, anon;
grant execute on function merge_category(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- products — public read; staff-only add/edit/delete
-- (stock still goes down at checkout via decrement_stock, unchanged)
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read products" on products;
create policy "Public can read products"
  on products for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can update products" on products;
drop policy if exists "Public can add products" on products;
drop policy if exists "Public can delete products" on products;

drop policy if exists "Staff can update products" on products;
create policy "Staff can update products"
  on products for update
  to authenticated
  using (is_staff())
  with check (is_staff());

drop policy if exists "Staff can add products" on products;
create policy "Staff can add products"
  on products for insert
  to authenticated
  with check (is_staff());

drop policy if exists "Staff can delete products" on products;
create policy "Staff can delete products"
  on products for delete
  to authenticated
  using (is_staff());

grant execute on function decrement_stock(text, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- rewards_signups — anyone can join; only staff can see the list
-- ---------------------------------------------------------------------------
drop policy if exists "Public can join rewards" on rewards_signups;
create policy "Public can join rewards"
  on rewards_signups for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can read rewards signups" on rewards_signups;
drop policy if exists "Staff can read rewards signups" on rewards_signups;
create policy "Staff can read rewards signups"
  on rewards_signups for select
  to authenticated
  using (is_staff());

-- ---------------------------------------------------------------------------
-- orders — anyone can place one; only staff can see or update them
-- ---------------------------------------------------------------------------
drop policy if exists "Public can create orders" on orders;
create policy "Public can create orders"
  on orders for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can read orders" on orders;
drop policy if exists "Public can update orders" on orders;

drop policy if exists "Staff can read orders" on orders;
create policy "Staff can read orders"
  on orders for select
  to authenticated
  using (is_staff());

drop policy if exists "Staff can update orders" on orders;
create policy "Staff can update orders"
  on orders for update
  to authenticated
  using (is_staff())
  with check (is_staff());

-- The homepage's "X orders ahead of you" used to count rows in `orders`
-- directly, which needed customers to be able to read orders. Now it asks
-- this function instead — it returns only a number, never order contents
-- or phone numbers.
create or replace function active_order_count()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer from orders where status <> 'completed';
$$;

grant execute on function active_order_count() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- restock_requests (unused by the app, but holds contact info) — staff only
-- ---------------------------------------------------------------------------
drop policy if exists "Public can request restock notifications" on restock_requests;
create policy "Public can request restock notifications"
  on restock_requests for insert
  to anon, authenticated
  with check (true);

drop policy if exists "Public can read restock requests" on restock_requests;
drop policy if exists "Public can update restock requests" on restock_requests;

drop policy if exists "Staff can read restock requests" on restock_requests;
create policy "Staff can read restock requests"
  on restock_requests for select
  to authenticated
  using (is_staff());

drop policy if exists "Staff can update restock requests" on restock_requests;
create policy "Staff can update restock requests"
  on restock_requests for update
  to authenticated
  using (is_staff())
  with check (is_staff());

-- ---------------------------------------------------------------------------
-- gallery_images — public read (writes were already server-only)
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read gallery images" on gallery_images;
create policy "Public can read gallery images"
  on gallery_images for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- hero_settings / hero_media — public read; staff-only changes
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read hero settings" on hero_settings;
create policy "Public can read hero settings"
  on hero_settings for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can update hero settings" on hero_settings;
drop policy if exists "Staff can update hero settings" on hero_settings;
create policy "Staff can update hero settings"
  on hero_settings for update
  to authenticated
  using (is_staff())
  with check (is_staff());

drop policy if exists "Public can read hero media" on hero_media;
create policy "Public can read hero media"
  on hero_media for select
  to anon, authenticated
  using (true);

drop policy if exists "Public can add hero media" on hero_media;
drop policy if exists "Public can update hero media" on hero_media;
drop policy if exists "Public can delete hero media" on hero_media;

drop policy if exists "Staff can add hero media" on hero_media;
create policy "Staff can add hero media"
  on hero_media for insert
  to authenticated
  with check (is_staff());

drop policy if exists "Staff can update hero media" on hero_media;
create policy "Staff can update hero media"
  on hero_media for update
  to authenticated
  using (is_staff())
  with check (is_staff());

drop policy if exists "Staff can delete hero media" on hero_media;
create policy "Staff can delete hero media"
  on hero_media for delete
  to authenticated
  using (is_staff());

create or replace function set_active_hero_media(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_staff() then
    raise exception 'Only signed-in staff can change the homepage';
  end if;
  update hero_media set is_active = (id = p_id);
end;
$$;

revoke execute on function set_active_hero_media(uuid) from public, anon;
grant execute on function set_active_hero_media(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage — photos stay publicly viewable; only staff can upload/replace/
-- delete them.
-- ---------------------------------------------------------------------------
drop policy if exists "Public can read product photos" on storage.objects;
create policy "Public can read product photos"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'product-photos');

drop policy if exists "Public can upload product photos" on storage.objects;
drop policy if exists "Public can update product photos" on storage.objects;

drop policy if exists "Staff can upload product photos" on storage.objects;
create policy "Staff can upload product photos"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'product-photos' and public.is_staff());

drop policy if exists "Staff can update product photos" on storage.objects;
create policy "Staff can update product photos"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'product-photos' and public.is_staff())
  with check (bucket_id = 'product-photos' and public.is_staff());

drop policy if exists "Public can read hero media files" on storage.objects;
create policy "Public can read hero media files"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'hero-media');

drop policy if exists "Public can upload hero media files" on storage.objects;
drop policy if exists "Public can delete hero media files" on storage.objects;

drop policy if exists "Staff can upload hero media files" on storage.objects;
create policy "Staff can upload hero media files"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'hero-media' and public.is_staff());

drop policy if exists "Staff can delete hero media files" on storage.objects;
create policy "Staff can delete hero media files"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'hero-media' and public.is_staff());

-- ---------------------------------------------------------------------------
-- FIRST OWNER — do this once, by hand:
--
--   1. Supabase > Authentication > Users > Add user > Create new user.
--      Enter the owner's email + a password, tick "Auto Confirm User".
--   2. Back here in the SQL Editor, run (with their real email):
--
--        insert into staff (user_id, email, name, role)
--        select id, email, 'Owner', 'owner' from auth.users
--        where email = 'owner@example.com'
--        on conflict (user_id) do update set role = 'owner';
--
-- From then on, that owner adds everyone else from the dashboard's Staff tab.
-- ---------------------------------------------------------------------------
