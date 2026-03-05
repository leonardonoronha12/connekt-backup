begin;

-- 1) Ensure owner column exists (produtor_id), and backfill from legacy columns
alter table public.simulados
  add column if not exists produtor_id uuid;

update public.simulados
set produtor_id = coalesce(produtor_id, user_id, created_by)
where produtor_id is null;

-- Keep legacy user_id in sync for older code paths
update public.simulados
set user_id = coalesce(user_id, produtor_id, created_by)
where user_id is null;

create index if not exists simulados_produtor_id_idx on public.simulados (produtor_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'simulados_produtor_id_fk'
  ) then
    alter table public.simulados
      add constraint simulados_produtor_id_fk
      foreign key (produtor_id) references auth.users(id)
      on delete set null;
  end if;
end $$;

-- 2) Tighten RLS: ONLY owners can read/write.
alter table public.simulados enable row level security;

drop policy if exists simulados_select_owner on public.simulados;
drop policy if exists simulados_select_any on public.simulados;
drop policy if exists simulados_select_own on public.simulados;
drop policy if exists simulados_insert_owner on public.simulados;
drop policy if exists simulados_insert_own on public.simulados;
drop policy if exists simulados_update_owner on public.simulados;
drop policy if exists simulados_update_own on public.simulados;
drop policy if exists simulados_update_unowned_legacy on public.simulados;
drop policy if exists simulados_delete_owner on public.simulados;

create policy simulados_select_owner
  on public.simulados
  for select
  to authenticated
  using (auth.uid() = produtor_id);

create policy simulados_insert_owner
  on public.simulados
  for insert
  to authenticated
  with check (auth.uid() = produtor_id);

create policy simulados_update_owner
  on public.simulados
  for update
  to authenticated
  using (auth.uid() = produtor_id)
  with check (auth.uid() = produtor_id);

create policy simulados_delete_owner
  on public.simulados
  for delete
  to authenticated
  using (auth.uid() = produtor_id);

-- 3) Refresh PostgREST schema cache
select pg_notify('pgrst', 'reload schema');

commit;

