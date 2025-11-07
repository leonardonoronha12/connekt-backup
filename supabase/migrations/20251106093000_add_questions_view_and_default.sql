-- Migration: Add default metadata for questions and a flattening view
-- This keeps the existing schema (title/body + metadata jsonb) and exposes
-- common fields via a convenience view for easier querying.

begin;

-- Ensure metadata has a sensible default structure
alter table public.questions
  alter column metadata set default '{
    "type": "multiple_choice",
    "required": false,
    "choices": [],
    "correctChoiceIndex": null,
    "points": 0,
    "attempts": 0
  }'::jsonb;

-- Convenience view: flatten key metadata fields for reporting/queries
create or replace view public.v_questions_flat as
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
  q.created_at,
  q.updated_at
from public.questions q;

commit;

-- Notes:
-- - RLS continues to apply via base table policies.
-- - Use the view for convenience; writes should still go to the base table.