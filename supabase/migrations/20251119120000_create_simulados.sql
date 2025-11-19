-- Create table to store simulated exams
create table if not exists public.simulados (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  cover_image_url text,
  is_paid boolean not null default false,
  price numeric(10,2) not null default 0,
  availability_date timestamptz,
  duration_minutes integer,
  max_grade integer,
  course_ids text[],
  question_ids text[],
  settings jsonb,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.simulados enable row level security;

-- Owner-based access: add user_id and bind policies to auth.uid()
alter table public.simulados add column if not exists user_id uuid;
-- Optional FK to auth.users (can't enforce in all environments)
-- alter table public.simulados add constraint simulados_user_fk foreign key (user_id) references auth.users (id);

-- Drop previous broad dev policies if they exist
drop policy if exists simulados_insert_authenticated on public.simulados;
drop policy if exists simulados_select_authenticated on public.simulados;
drop policy if exists simulados_update_authenticated on public.simulados;
drop policy if exists simulados_insert_anon on public.simulados;
drop policy if exists simulados_select_anon on public.simulados;
drop policy if exists simulados_update_anon on public.simulados;

-- Create owner-scoped policies for authenticated users
create policy simulados_select_owner
  on public.simulados
  for select
  to authenticated
  using (auth.uid() = user_id);

create policy simulados_insert_owner
  on public.simulados
  for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy simulados_update_owner
  on public.simulados
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);