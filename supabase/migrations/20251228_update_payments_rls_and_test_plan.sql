-- Allow 'teste' plan in payments constraint
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
  check (plan_slug in ('start','pro','premium','teste'));

-- Enable RLS and allow authenticated users to read their own payments
alter table public.payments enable row level security;

drop policy if exists "payments_select_own" on public.payments;
create policy "payments_select_own"
  on public.payments
  for select
  to authenticated
  using (auth.uid() = user_id);

