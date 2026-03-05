begin;

create extension if not exists "pgcrypto";

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null,
  recipient_role text,
  type text,
  title text,
  message text,
  actor_user_id uuid,
  actor_name text,
  entity_type text,
  entity_id text,
  entity_name text,
  href text,
  data jsonb,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_recipient_user_id on public.notifications (recipient_user_id);
create index if not exists idx_notifications_created_at on public.notifications (created_at desc);
create index if not exists idx_notifications_read_at on public.notifications (read_at);

alter table public.notifications enable row level security;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications
  for select
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications
  for update
  to authenticated
  using (recipient_user_id = auth.uid())
  with check (recipient_user_id = auth.uid());

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications
  for delete
  to authenticated
  using (recipient_user_id = auth.uid());

drop policy if exists notifications_insert_own on public.notifications;
create policy notifications_insert_own
  on public.notifications
  for insert
  to authenticated
  with check (recipient_user_id = auth.uid());

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null,
  buyer_id uuid,
  type text,
  entity_type text,
  entity_id text,
  link_id text,
  amount_cents integer not null default 0,
  status text not null default 'paid',
  created_at timestamptz not null default now()
);

create index if not exists idx_sales_producer_id on public.sales (producer_id);
create index if not exists idx_sales_created_at on public.sales (created_at desc);
create index if not exists idx_sales_status on public.sales (status);

alter table public.sales enable row level security;

drop policy if exists sales_select_own on public.sales;
create policy sales_select_own
  on public.sales
  for select
  to authenticated
  using (producer_id = auth.uid());

commit;
