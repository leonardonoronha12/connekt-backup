-- Ensure user_id column exists and adjust RLS policies for public.simulados
-- This migration addresses PostgREST error PGRST204: user_id missing in schema cache

begin;

-- 1) Add column user_id if missing and index it
alter table public.simulados
  add column if not exists user_id uuid;

create index if not exists simulados_user_id_idx on public.simulados (user_id);

-- 2) Optional FK to auth.users; safe in Supabase projects
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_schema = 'public'
      and table_name = 'simulados'
      and constraint_name = 'simulados_user_id_fk'
  ) then
    alter table public.simulados
      add constraint simulados_user_id_fk
      foreign key (user_id) references auth.users (id)
      on delete set null;
  end if;
end $$;

-- 3) Enable RLS (idempotent)
alter table public.simulados enable row level security;

-- 4) Drop existing policies to avoid duplicates
drop policy if exists simulados_select_owner on public.simulados;
drop policy if exists simulados_insert_owner on public.simulados;
drop policy if exists simulados_update_owner on public.simulados;
drop policy if exists simulados_select_any on public.simulados;
drop policy if exists simulados_update_unowned_legacy on public.simulados;

-- 5) Recreate policies
-- Read: allow owners OR records without owner (legacy)
create policy simulados_select_any
  on public.simulados
  for select
  to authenticated
  using (
    user_id is null or auth.uid() = user_id
  );

-- Insert: only owner can insert (must set user_id = auth.uid())
create policy simulados_insert_owner
  on public.simulados
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Update: owners can update their records
create policy simulados_update_owner
  on public.simulados
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- TEMP: allow updating records without owner for debugging/backfill
create policy simulados_update_unowned_legacy
  on public.simulados
  for update
  to authenticated
  using (user_id is null)
  with check (user_id is null);

-- 6) Refresh PostgREST schema cache
-- Supabase listens to pg_notify channel 'pgrst'
select pg_notify('pgrst', 'reload schema');

commit;