create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id),
  title text not null,
  description text,
  modules jsonb default '[]'::jsonb,
  theme_primary_color text,
  theme_secondary_color text,
  theme_text_color text,
  status text default 'draft',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.courses enable row level security;

drop policy if exists "Users can select their own courses"
  on public.courses;
create policy "Users can select their own courses"
  on public.courses for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own courses"
  on public.courses;
create policy "Users can insert their own courses"
  on public.courses for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own courses"
  on public.courses;
create policy "Users can update their own courses"
  on public.courses for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their own courses"
  on public.courses;
create policy "Users can delete their own courses"
  on public.courses for delete
  using (auth.uid() = user_id);
