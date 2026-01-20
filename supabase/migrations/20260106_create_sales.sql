create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references auth.users(id) on delete cascade,
  amount_cents integer not null default 0,
  currency text not null default 'BRL',
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create index if not exists sales_producer_id_idx on public.sales (producer_id);
create index if not exists sales_created_at_idx on public.sales (created_at desc);

alter table public.sales enable row level security;

drop policy if exists sales_select_own on public.sales;
create policy sales_select_own
  on public.sales
  for select
  to authenticated
  using (auth.uid() = producer_id);

drop policy if exists sales_insert_own on public.sales;
create policy sales_insert_own
  on public.sales
  for insert
  to authenticated
  with check (auth.uid() = producer_id);

