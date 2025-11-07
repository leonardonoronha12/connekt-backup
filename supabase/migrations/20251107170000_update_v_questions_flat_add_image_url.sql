-- Atualiza a view v_questions_flat para expor image_url e image_path
begin;

-- Remover a view para permitir alteração da lista de colunas
drop view if exists public.v_questions_flat;

create view public.v_questions_flat as
select
  q.id,
  q.question_bank_id,
  q.title,
  q.body as question,
  q.metadata->'choices' as choices,
  (q.metadata->>'required')::boolean as required,
  nullif(q.metadata->>'correctChoiceIndex', '')::int as correct_choice_index,
  nullif(q.metadata->>'points', '')::int as points,
  nullif(q.metadata->>'attempts', '')::int as attempts,
  q.metadata->>'imageUrl' as image_url,
  q.metadata->>'imagePath' as image_path,
  q.created_at,
  q.updated_at
from public.questions q;

commit;

-- Observações:
-- - A URL é lida de metadata.imageUrl e o caminho de metadata.imagePath.
-- - A view é somente para leitura; escritas devem ir para public.questions.