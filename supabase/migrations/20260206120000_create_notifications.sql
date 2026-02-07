create table if not exists public.notifications (
  id uuid primary key,
  recipient_user_id uuid not null,
  recipient_role text null,
  type text not null,
  title text null,
  message text null,
  actor_user_id uuid null,
  actor_name text null,
  entity_type text null,
  entity_id text null,
  entity_name text null,
  href text null,
  read_at timestamptz null,
  created_at timestamptz not null default now(),
  data jsonb not null default '{}'::jsonb
);

alter table public.notifications enable row level security;

create index if not exists notifications_recipient_idx on public.notifications (recipient_user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (recipient_user_id) where read_at is null;

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
using (auth.uid() = recipient_user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
using (auth.uid() = recipient_user_id)
with check (auth.uid() = recipient_user_id);

drop policy if exists "notifications_delete_own" on public.notifications;
create policy "notifications_delete_own"
on public.notifications
for delete
using (auth.uid() = recipient_user_id);

