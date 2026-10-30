-- Per-product "hide from the website" switch (dashboard → Products).
-- The item stays in Clover and is still sold at the register. Clover sync
-- never touches this column, so a hidden item stays hidden.
alter table public.products add column if not exists hide_online boolean not null default false;
