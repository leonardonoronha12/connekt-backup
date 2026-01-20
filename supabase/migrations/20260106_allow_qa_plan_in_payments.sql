do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'payments_plan_slug_check'
  ) then
    alter table public.payments drop constraint payments_plan_slug_check;
  end if;
exception when others then
  null;
end $$;

alter table public.payments
  add constraint payments_plan_slug_check
  check (plan_slug in ('start','pro','premium','teste','qa'));

