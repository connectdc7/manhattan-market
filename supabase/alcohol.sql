-- Manhattan Market — wine & beer online, 21+ (run once; safe to re-run)
--
-- categories.age_restricted: items in these categories need the 21+ check
--   online and an ID check at pickup.
-- store_settings.alcohol_delivery: off = wine/beer are pickup-only (owner can
--   switch it on in dashboard → Settings once DC ABCA and Uber confirm).
-- orders.contains_alcohol: flags the order for staff (dashboard + Clover).
alter table categories add column if not exists age_restricted boolean not null default false;
alter table store_settings add column if not exists alcohol_delivery boolean not null default false;
alter table orders add column if not exists contains_alcohol boolean not null default false;

-- Mark the store's wine and beer departments 21+ and show them online.
update categories
set age_restricted = true, show_on_storefront = true, needs_review = false
where lower(name) like '%wine%' or lower(name) like '%beer%';
