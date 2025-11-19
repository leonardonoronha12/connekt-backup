-- Add created_by column tied to authenticated user and tighten RLS
alter table public.simulados
  add column if not exists created_by uuid default auth.uid();

-- Reference to auth.users (Supabase user IDs)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulados_created_by_fk'
  ) then
    alter table public.simulados
      add constraint simulados_created_by_fk
      foreign key (created_by) references auth.users(id) on delete cascade;
  end if;
end $$;

create index if not exists simulados_created_by_idx on public.simulados(created_by);

-- Replace broad policies with user-scoped ones
drop policy if exists simulados_select_authenticated on public.simulados;
drop policy if exists simulados_insert_authenticated on public.simulados;

create policy simulados_select_own
  on public.simulados
  for select
  to authenticated
  using (created_by = auth.uid());

create policy simulados_insert_own
  on public.simulados
  for insert
  to authenticated
  with check (coalesce(created_by, auth.uid()) = auth.uid());