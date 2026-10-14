-- Manhattan Market — Gallery photo library (run once; safe to re-run)
--
-- Any number of real photos for the public Gallery page, uploaded from the
-- dashboard's Gallery tab (several at a time). Files live in the existing
-- public hero-media bucket under a gallery/ prefix, which already lets
-- staff upload and delete (supabase/staff-login.sql). Anyone can view;
-- only signed-in staff can add, edit or remove.
create table if not exists gallery_photos (
  id uuid primary key default gen_random_uuid(),
  url text not null,
  storage_path text not null,
  caption text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table gallery_photos enable row level security;

drop policy if exists "Public can read gallery photos" on gallery_photos;
create policy "Public can read gallery photos"
  on gallery_photos for select
  to anon, authenticated
  using (true);

drop policy if exists "Staff can add gallery photos" on gallery_photos;
create policy "Staff can add gallery photos"
  on gallery_photos for insert
  to authenticated
  with check (is_staff());

drop policy if exists "Staff can update gallery photos" on gallery_photos;
create policy "Staff can update gallery photos"
  on gallery_photos for update
  to authenticated
  using (is_staff())
  with check (is_staff());

drop policy if exists "Staff can delete gallery photos" on gallery_photos;
create policy "Staff can delete gallery photos"
  on gallery_photos for delete
  to authenticated
  using (is_staff());
