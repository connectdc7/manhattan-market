-- Manhattan Market — first-order welcome offer (run once; safe to re-run).
-- Owner turns it on and sets the code/amount/minimum in Dashboard → Settings.
-- Each phone number can use it once, on its first order (checked server-side).
alter table store_settings add column if not exists welcome_offer_enabled boolean not null default false;
alter table store_settings add column if not exists welcome_code text not null default 'WELCOME5';
alter table store_settings add column if not exists welcome_amount numeric not null default 5;
alter table store_settings add column if not exists welcome_min numeric not null default 20;
alter table orders add column if not exists discount_code text;
alter table orders add column if not exists discount_amount numeric;
