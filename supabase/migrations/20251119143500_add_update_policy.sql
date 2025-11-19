-- Allow updates only by the owner of the row
create policy simulados_update_own
  on public.simulados
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());