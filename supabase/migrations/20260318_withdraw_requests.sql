create table if not exists public.withdraw_requests (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'advance',
  amount_cents bigint not null default 0,
  status text not null default 'requested',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdraw_requests_producer_id_idx on public.withdraw_requests (producer_id, created_at desc);

alter table public.withdraw_requests enable row level security;

drop policy if exists withdraw_requests_select_own on public.withdraw_requests;
create policy withdraw_requests_select_own
  on public.withdraw_requests
  for select
  to authenticated
  using (auth.uid() = producer_id);

drop policy if exists withdraw_requests_insert_own on public.withdraw_requests;
create policy withdraw_requests_insert_own
  on public.withdraw_requests
  for insert
  to authenticated
  with check (auth.uid() = producer_id);

drop policy if exists withdraw_requests_update_own on public.withdraw_requests;
create policy withdraw_requests_update_own
  on public.withdraw_requests
  for update
  to authenticated
  using (auth.uid() = producer_id)
  with check (auth.uid() = producer_id);

do $$
begin
  if to_regclass('public.touch_updated_at') is not null then
    drop trigger if exists trg_withdraw_requests_updated_at on public.withdraw_requests;
    create trigger trg_withdraw_requests_updated_at
    before update on public.withdraw_requests
    for each row execute function public.touch_updated_at();
  elsif to_regclass('public.set_updated_at') is not null then
    drop trigger if exists trg_withdraw_requests_updated_at on public.withdraw_requests;
    create trigger trg_withdraw_requests_updated_at
    before update on public.withdraw_requests
    for each row execute function public.set_updated_at();
  else
    create or replace function public.set_updated_at_withdraw_requests()
    returns trigger as $$
    begin
      new.updated_at = now();
      return new;
    end;
    $$ language plpgsql;

    drop trigger if exists trg_withdraw_requests_updated_at on public.withdraw_requests;
    create trigger trg_withdraw_requests_updated_at
    before update on public.withdraw_requests
    for each row execute function public.set_updated_at_withdraw_requests();
  end if;
exception when others then
  null;
end $$;

do $$
begin
  perform pg_notify('pgrst', 'reload schema');
exception when others then
  null;
end $$;

