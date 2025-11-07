-- Create table to log uploaded images
create table if not exists public.imagens_logs (
  id uuid primary key default gen_random_uuid(),
  bank_id text,
  question_id text,
  filename text not null,
  content_type text,
  path text,
  url text,
  uploader_external_id text,
  created_at timestamptz not null default now()
);

alter table public.imagens_logs enable row level security;

-- Allow authenticated clients to insert and read their logs (broad policy for dev)
create policy imagens_logs_insert_authenticated
  on public.imagens_logs
  for insert
  to authenticated
  with check (true);

create policy imagens_logs_select_authenticated
  on public.imagens_logs
  for select
  to authenticated
  using (true);