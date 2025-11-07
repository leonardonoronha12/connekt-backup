-- Insert a validation row into imagens_logs
insert into public.imagens_logs (
  bank_id,
  question_id,
  filename,
  content_type,
  path,
  url,
  uploader_external_id
) values (
  'validate-bank',
  'validate-question',
  'validate-from-migration.png',
  'image/png',
  'question-images/validate-from-migration.png',
  'https://example.invalid/validate-from-migration.png',
  'migration-validation'
);