-- Manhattan Market — new-order alerts on staff phones (run once; safe to re-run)
-- One row per phone/browser that turned on alerts in the dashboard. Rows are
-- tied to the signed-in staff member; signing out removes that phone's row,
-- and removing someone from Staff stops their alerts (lib/push.ts checks).
-- Only the server (service role) reads or writes this table.
create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);
alter table push_subscriptions enable row level security;
-- (no policies on purpose: the browser never touches this table directly)
