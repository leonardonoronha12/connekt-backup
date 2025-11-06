-- Seed de validação para question_banks e questions
-- IMPORTANTE: Substitua <AUTH_UID_HERE> abaixo pelo ID do usuário em Auth → Users
-- Esse seed deve ser executado no Supabase Studio (SQL Editor)

BEGIN;

-- Garantir que a extensão usada para UUID aleatório esteja disponível
-- (no Supabase já vem habilitado normalmente)
-- CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Insere um banco de questões de teste vinculado ao usuário
WITH inserted_bank AS (
  INSERT INTO public.question_banks (
    id,
    name,
    description,
    tags,
    category,
    subcategory,
    producer_external_id
  ) VALUES (
    gen_random_uuid(),
    'Banco de Teste',
    'Seed de validação gerado via migration',
    '[]'::jsonb,
    'Cardiologia',
    'Geral',
    '<AUTH_UID_HERE>'::uuid
  )
  RETURNING id
)
-- Insere duas questões para o banco
INSERT INTO public.questions (
  id,
  question_bank_id,
  title,
  body,
  metadata
)
SELECT gen_random_uuid(), inserted_bank.id, 'Questão 1', 'Enunciado da questão 1', '{}'::jsonb FROM inserted_bank
UNION ALL
SELECT gen_random_uuid(), inserted_bank.id, 'Questão 2', 'Enunciado da questão 2', '{}'::jsonb FROM inserted_bank;

COMMIT;

-- Verificações rápidas
-- Deve retornar question_count = 2
SELECT id, name, question_count FROM public.question_banks WHERE name = 'Banco de Teste';
SELECT id, title FROM public.questions WHERE question_bank_id = (
  SELECT id FROM public.question_banks WHERE name = 'Banco de Teste'
);

-- Limpeza opcional
-- DELETE FROM public.question_banks WHERE name = 'Banco de Teste'; -- cascata em questions