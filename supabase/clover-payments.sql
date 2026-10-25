-- Manhattan Market — online payments through Clover Hosted Checkout
-- (run once; safe to re-run). Stripe keeps working; the owner picks which
-- one customers use in Dashboard → Settings → Online payments.

-- Which processor customers pay through. 'stripe' until the owner switches.
alter table store_settings add column if not exists payment_provider text not null default 'stripe';
alter table store_settings drop constraint if exists store_settings_payment_provider_check;
alter table store_settings add constraint store_settings_payment_provider_check check (payment_provider in ('stripe', 'clover'));

-- How each online order was paid. Stripe orders keep using stripe_session_id.
alter table orders add column if not exists payment_provider text;
alter table orders add column if not exists clover_checkout_id text;
alter table orders add column if not exists clover_payment_id text;
create unique index if not exists orders_clover_checkout_id_key on orders (clover_checkout_id) where clover_checkout_id is not null;

-- A Clover checkout in progress: what's in the cart, until Clover confirms
-- payment (app/api/clover/checkout-webhook) and the real order is created.
-- Server-only (service role) — no browser access.
create table if not exists pending_checkouts (
  id text primary key,                 -- Clover checkoutSessionId
  ref uuid not null unique,            -- our id, used on the "order placed" page
  payload jsonb not null,
  status text not null default 'pending', -- pending | paid | declined
  order_id uuid,
  payment_id text,
  created_at timestamptz not null default now()
);
alter table pending_checkouts enable row level security;
