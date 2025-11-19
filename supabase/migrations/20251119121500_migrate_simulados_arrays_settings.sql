-- Migration: Normalize simulados arrays into settings and backfill if needed
-- This updates settings.courseIds/questionIds from top-level columns when present,
-- and optionally backfills top-level columns from settings if they exist and are empty.

BEGIN;

-- 1) Copy top-level course_ids into settings.courseIds when settings is empty/missing
DO $$
BEGIN
  UPDATE public.simulados s
  SET settings = jsonb_set(
      COALESCE(s.settings, '{}'::jsonb),
      '{courseIds}',
      to_jsonb(s.course_ids),
      true
    )
  WHERE (
      s.settings IS NULL
      OR (s.settings ? 'courseIds' = false)
      OR (jsonb_typeof(s.settings->'courseIds') = 'array' AND jsonb_array_length(s.settings->'courseIds') = 0)
    )
    AND s.course_ids IS NOT NULL
    AND array_length(s.course_ids, 1) > 0;
EXCEPTION
  WHEN undefined_table THEN
    NULL; -- simulados table might not exist in some environments
  WHEN undefined_column THEN
    NULL; -- course_ids column might not exist
END $$;

-- 2) Copy top-level question_ids into settings.questionIds when settings is empty/missing
DO $$
BEGIN
  UPDATE public.simulados s
  SET settings = jsonb_set(
      COALESCE(s.settings, '{}'::jsonb),
      '{questionIds}',
      to_jsonb(s.question_ids),
      true
    )
  WHERE (
      s.settings IS NULL
      OR (s.settings ? 'questionIds' = false)
      OR (jsonb_typeof(s.settings->'questionIds') = 'array' AND jsonb_array_length(s.settings->'questionIds') = 0)
    )
    AND s.question_ids IS NOT NULL
    AND array_length(s.question_ids, 1) > 0;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_column THEN
    NULL; -- question_ids column might not exist
END $$;

-- 3) Backfill top-level course_ids from settings.courseIds when top-level is null/empty
DO $$
BEGIN
  UPDATE public.simulados s
  SET course_ids = (
    SELECT COALESCE(ARRAY(
      SELECT (elem)::uuid
      FROM jsonb_array_elements_text(s.settings->'courseIds') AS elem
    ), ARRAY[]::uuid[])
  )
  WHERE (
      s.course_ids IS NULL
      OR array_length(s.course_ids, 1) IS NULL
      OR array_length(s.course_ids, 1) = 0
    )
    AND s.settings IS NOT NULL
    AND (s.settings ? 'courseIds')
    AND jsonb_typeof(s.settings->'courseIds') = 'array'
    AND jsonb_array_length(s.settings->'courseIds') > 0;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_column THEN
    NULL; -- course_ids might not exist
  WHEN invalid_text_representation THEN
    NULL; -- if elements are not valid UUIDs, skip backfill
END $$;

-- 4) Backfill top-level question_ids from settings.questionIds when top-level is null/empty
DO $$
BEGIN
  UPDATE public.simulados s
  SET question_ids = (
    SELECT COALESCE(ARRAY(
      SELECT (elem)::uuid
      FROM jsonb_array_elements_text(s.settings->'questionIds') AS elem
    ), ARRAY[]::uuid[])
  )
  WHERE (
      s.question_ids IS NULL
      OR array_length(s.question_ids, 1) IS NULL
      OR array_length(s.question_ids, 1) = 0
    )
    AND s.settings IS NOT NULL
    AND (s.settings ? 'questionIds')
    AND jsonb_typeof(s.settings->'questionIds') = 'array'
    AND jsonb_array_length(s.settings->'questionIds') > 0;
EXCEPTION
  WHEN undefined_table THEN
    NULL;
  WHEN undefined_column THEN
    NULL; -- question_ids might not exist
  WHEN invalid_text_representation THEN
    NULL; -- if elements are not valid UUIDs, skip backfill
END $$;

COMMIT;