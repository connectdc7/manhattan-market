-- When each online order reached each stage, and Uber's time estimates —
-- shown on the dashboard's live orders board (timers, "courier arrives ~2:14").
alter table public.orders
  add column if not exists preparing_at timestamptz,
  add column if not exists ready_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists uber_pickup_eta timestamptz,
  add column if not exists uber_dropoff_eta timestamptz;

create or replace function public.stamp_order_stage() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'preparing' then new.preparing_at := now(); end if;
    if new.status = 'ready' then new.ready_at := now(); end if;
    if new.status = 'completed' then new.completed_at := now(); end if;
  end if;
  return new;
end $$;

drop trigger if exists orders_stamp_stage on public.orders;
create trigger orders_stamp_stage before update of status on public.orders
  for each row execute function public.stamp_order_stage();
