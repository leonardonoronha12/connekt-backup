-- Validate presence of the inserted test row in imagens_logs
do $$
declare c int;
begin
  select count(*) into c from public.imagens_logs where question_id = 'validate-question';
  if c = 0 then
    raise exception 'Validation failed: imagens_logs has no test row.';
  end if;
end $$;