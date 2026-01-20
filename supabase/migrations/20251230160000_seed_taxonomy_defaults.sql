create or replace function public.seed_taxonomy_defaults(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid_text text := p_user_id::text;
  tag_ecg text := 'tag_' || uid_text || '_ecg';
  tag_arritmias text := 'tag_' || uid_text || '_arritmias';
  tag_exames text := 'tag_' || uid_text || '_exames';
  tag_emergencia text := 'tag_' || uid_text || '_emergencia';
  tag_neuro text := 'tag_' || uid_text || '_neuro';
  tag_infantil text := 'tag_' || uid_text || '_infantil';
  tag_prevencao text := 'tag_' || uid_text || '_prevencao';
  tag_cronico text := 'tag_' || uid_text || '_cronico';
  tag_cardio text := 'tag_' || uid_text || '_cardio';
  tag_urgencia text := 'tag_' || uid_text || '_urgencia';
  tag_hospitalar text := 'tag_' || uid_text || '_hospitalar';
  tag_clinica text := 'tag_' || uid_text || '_clinica';
  tag_cirurgia text := 'tag_' || uid_text || '_cirurgia';
  tag_medicina text := 'tag_' || uid_text || '_medicina';
  tag_saude text := 'tag_' || uid_text || '_saude';
  tag_cerebro text := 'tag_' || uid_text || '_cerebro';
  tag_nervos text := 'tag_' || uid_text || '_nervos';
  tag_crianca text := 'tag_' || uid_text || '_crianca';

  cat_cardiologia text := 'cat_' || uid_text || '_cardiologia';
  cat_neurologia text := 'cat_' || uid_text || '_neurologia';
  cat_pediatria text := 'cat_' || uid_text || '_pediatria';
  cat_clinica text := 'cat_' || uid_text || '_clinica';

  sub_ecg text := 'sub_' || uid_text || '_eletrocardiograma';
  sub_avc text := 'sub_' || uid_text || '_avc_agudo';
  sub_pueri text := 'sub_' || uid_text || '_puericultura';
  sub_ic text := 'sub_' || uid_text || '_insuficiencia_cardiaca';
begin
  insert into public.taxonomy_tags (id, created_by, name, description, color)
  values
    (tag_ecg, p_user_id, 'ECG', 'Tag existente', '#94A3B8'),
    (tag_arritmias, p_user_id, 'Arritmias', 'Tag existente', '#94A3B8'),
    (tag_exames, p_user_id, 'Exames', 'Tag existente', '#94A3B8'),
    (tag_emergencia, p_user_id, 'Emergência', 'Tag existente', '#94A3B8'),
    (tag_neuro, p_user_id, 'Neuro', 'Tag existente', '#94A3B8'),
    (tag_infantil, p_user_id, 'Infantil', 'Tag existente', '#94A3B8'),
    (tag_prevencao, p_user_id, 'Prevenção', 'Tag existente', '#94A3B8'),
    (tag_cronico, p_user_id, 'Crônico', 'Tag existente', '#94A3B8'),
    (tag_cardio, p_user_id, 'Cardio', 'Tag existente', '#94A3B8'),
    (tag_urgencia, p_user_id, 'Urgência', 'Tag existente', '#94A3B8'),
    (tag_hospitalar, p_user_id, 'Hospitalar', 'Tag existente', '#94A3B8'),
    (tag_clinica, p_user_id, 'Clínica', 'Tag existente', '#94A3B8'),
    (tag_cirurgia, p_user_id, 'Cirurgia', 'Tag existente', '#94A3B8'),
    (tag_medicina, p_user_id, 'Medicina', 'Tag existente', '#94A3B8'),
    (tag_saude, p_user_id, 'Saúde', 'Tag existente', '#94A3B8'),
    (tag_cerebro, p_user_id, 'Cérebro', 'Tag existente', '#94A3B8'),
    (tag_nervos, p_user_id, 'Nervos', 'Tag existente', '#94A3B8'),
    (tag_crianca, p_user_id, 'Criança', 'Tag existente', '#94A3B8')
  on conflict (id) do nothing;

  insert into public.taxonomy_categories (id, created_by, name, description, color, tag_ids)
  values
    (cat_cardiologia, p_user_id, 'Cardiologia', 'Doenças do coração e sistema cardiovascular.', '#EC4899', array[tag_medicina, tag_saude]),
    (cat_neurologia, p_user_id, 'Neurologia', 'Condições do sistema nervoso central e periférico.', '#8B5CF6', array[tag_cerebro, tag_nervos]),
    (cat_pediatria, p_user_id, 'Pediatria', 'Saúde e desenvolvimento de crianças e adolescentes.', '#10B981', array[tag_crianca, tag_infantil]),
    (cat_clinica, p_user_id, 'Clínica', 'Medicina geral e atendimento clínico.', '#F59E0B', array[]::text[])
  on conflict (id) do nothing;

  insert into public.taxonomy_subcategories (id, created_by, name, description, color, category_ids, tag_ids, products_count)
  values
    (sub_ecg, p_user_id, 'Eletrocardiograma', 'Básico e avançado sobre ECG e arritmias.', '#3B82F6', array[cat_cardiologia], array[tag_ecg, tag_arritmias, tag_exames], 12),
    (sub_avc, p_user_id, 'AVC Agudo', 'Protocolos de atendimento ao AVC isquêmico e hemorrágico.', '#EF4444', array[cat_neurologia], array[tag_emergencia, tag_neuro], 8),
    (sub_pueri, p_user_id, 'Puericultura', 'Acompanhamento do desenvolvimento infantil.', '#10B981', array[cat_pediatria], array[tag_infantil, tag_prevencao], 15),
    (sub_ic, p_user_id, 'Insuficiência Cardíaca', 'Manejo da IC crônica e aguda.', '#A855F7', array[cat_cardiologia], array[tag_cronico, tag_cardio], 5)
  on conflict (id) do nothing;
end;
$$;

do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'on_auth_user_created_seed_taxonomy') then
    drop trigger on_auth_user_created_seed_taxonomy on auth.users;
  end if;
exception when undefined_table then
  null;
end $$;

create or replace function public.handle_auth_user_created_seed_taxonomy()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.seed_taxonomy_defaults(new.id);
  return new;
end;
$$;

do $$
begin
  if to_regclass('auth.users') is not null then
    create trigger on_auth_user_created_seed_taxonomy
      after insert on auth.users
      for each row
      execute function public.handle_auth_user_created_seed_taxonomy();
  end if;
exception when others then
  null;
end $$;

do $$
declare
  u record;
begin
  for u in (select id from auth.users)
  loop
    if not exists (select 1 from public.taxonomy_categories where created_by = u.id limit 1) then
      perform public.seed_taxonomy_defaults(u.id);
    end if;
  end loop;
exception when others then
  null;
end $$;
