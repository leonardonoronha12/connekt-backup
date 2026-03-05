begin;

alter table public.simulados enable row level security;

drop policy if exists simulados_select_published_public on public.simulados;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'simulados'
      and column_name = 'availability_date'
  ) then
    execute $pol$
      create policy simulados_select_published_public
      on public.simulados
      for select
      to anon, authenticated
      using (availability_date is null or availability_date <= now())
    $pol$;
  else
    execute $pol$
      create policy simulados_select_published_public
      on public.simulados
      for select
      to anon, authenticated
      using (false)
    $pol$;
  end if;
end $$;

select pg_notify('pgrst', 'reload schema');

commit;

