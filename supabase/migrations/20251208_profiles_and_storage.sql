create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  active_plan text,
  plan_activated_at timestamptz,
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;

create policy "profiles_select_own"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = user_id);

create policy "profiles_insert_own"
  on public.profiles
  for insert
  to authenticated
  with check (auth.uid() = user_id);

insert into storage.buckets (id, name, public)
values ('imagens-logs', 'imagens-logs', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "imagens-logs select public" on storage.objects;
create policy "imagens-logs select public"
on storage.objects
for select
to public
using (bucket_id = 'imagens-logs');

drop policy if exists "imagens-logs insert authenticated" on storage.objects;
create policy "imagens-logs insert authenticated"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'imagens-logs');

