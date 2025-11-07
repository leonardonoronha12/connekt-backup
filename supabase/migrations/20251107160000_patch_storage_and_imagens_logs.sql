-- 1) Policies para permitir INSERT no Storage (bucket 'images')
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'allow_anon_insert_images'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "allow_anon_insert_images"
    ON storage.objects
    FOR INSERT
    TO anon
    WITH CHECK (bucket_id = 'images');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'allow_authenticated_insert_images'
      AND polrelid = 'storage.objects'::regclass
  ) THEN
    CREATE POLICY "allow_authenticated_insert_images"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'images');
  END IF;
END
$$;

-- 2) Tabela e policies de logs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.imagens_logs (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  file_name text,
  path text,
  bucket text default 'images',
  mime_type text,
  size_bytes bigint,
  title text,
  content_id uuid,
  created_at timestamptz default now()
);

ALTER TABLE public.imagens_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'imagens_logs_insert_anon'
      AND polrelid = 'public.imagens_logs'::regclass
  ) THEN
    CREATE POLICY "imagens_logs_insert_anon"
    ON public.imagens_logs FOR INSERT TO anon WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'imagens_logs_select_anon'
      AND polrelid = 'public.imagens_logs'::regclass
  ) THEN
    CREATE POLICY "imagens_logs_select_anon"
    ON public.imagens_logs FOR SELECT TO anon USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'imagens_logs_insert_authenticated'
      AND polrelid = 'public.imagens_logs'::regclass
  ) THEN
    CREATE POLICY "imagens_logs_insert_authenticated"
    ON public.imagens_logs FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polname = 'imagens_logs_select_authenticated'
      AND polrelid = 'public.imagens_logs'::regclass
  ) THEN
    CREATE POLICY "imagens_logs_select_authenticated"
    ON public.imagens_logs FOR SELECT TO authenticated USING (true);
  END IF;
END
$$;