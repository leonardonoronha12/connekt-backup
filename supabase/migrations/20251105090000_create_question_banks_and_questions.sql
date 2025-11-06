-- Migration: Create question_banks and questions with RLS and triggers
-- Project: ucsijwfarkrljbkdvrbd

-- Extensions
create extension if not exists "pgcrypto";

-- Table: public.question_banks
create table if not exists public.question_banks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  tags jsonb not null default '[]'::jsonb,
  category text,
  subcategory text,
  producer_external_id uuid not null,
  question_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for question_banks
create index if not exists idx_question_banks_producer on public.question_banks (producer_external_id);

-- Table: public.questions
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  question_bank_id uuid not null references public.question_banks(id) on delete cascade,
  title text,
  body text,
  metadata jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Indexes for questions
create index if not exists idx_questions_bank on public.questions (question_bank_id);

-- RLS enable
alter table public.question_banks enable row level security;
alter table public.questions enable row level security;

drop policy if exists question_banks_select_own on public.question_banks;
create policy question_banks_select_own
  on public.question_banks
  for select
  using (producer_external_id = auth.uid());

drop policy if exists question_banks_insert_own on public.question_banks;
create policy question_banks_insert_own
  on public.question_banks
  for insert
  with check (producer_external_id = auth.uid());

drop policy if exists question_banks_update_own on public.question_banks;
create policy question_banks_update_own
  on public.question_banks
  for update
  using (producer_external_id = auth.uid())
  with check (producer_external_id = auth.uid());

drop policy if exists question_banks_delete_own on public.question_banks;
create policy question_banks_delete_own
  on public.question_banks
  for delete
  using (producer_external_id = auth.uid());

drop policy if exists questions_select_owned_banks on public.questions;
create policy questions_select_owned_banks
  on public.questions
  for select
  using (exists (
    select 1 from public.question_banks qb
    where qb.id = questions.question_bank_id
      and qb.producer_external_id = auth.uid()
  ));

drop policy if exists questions_insert_owned_banks on public.questions;
create policy questions_insert_owned_banks
  on public.questions
  for insert
  with check (exists (
    select 1 from public.question_banks qb
    where qb.id = questions.question_bank_id
      and qb.producer_external_id = auth.uid()
  ));

drop policy if exists questions_update_owned_banks on public.questions;
create policy questions_update_owned_banks
  on public.questions
  for update
  using (exists (
    select 1 from public.question_banks qb
    where qb.id = questions.question_bank_id
      and qb.producer_external_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.question_banks qb
    where qb.id = questions.question_bank_id
      and qb.producer_external_id = auth.uid()
  ));

drop policy if exists questions_delete_owned_banks on public.questions;
create policy questions_delete_owned_banks
  on public.questions
  for delete
  using (exists (
    select 1 from public.question_banks qb
    where qb.id = questions.question_bank_id
      and qb.producer_external_id = auth.uid()
  ));

-- Trigger: updated_at auto-update
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_question_banks_updated_at on public.question_banks;
create trigger set_question_banks_updated_at
before update on public.question_banks
for each row execute function public.set_updated_at();

drop trigger if exists set_questions_updated_at on public.questions;
create trigger set_questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- Triggers: maintain question_count on insert/delete
create or replace function public.increment_question_count()
returns trigger as $$
begin
  update public.question_banks
    set question_count = coalesce(question_count, 0) + 1,
        updated_at = now()
    where id = new.question_bank_id;
  return new;
end;
$$ language plpgsql;

create or replace function public.decrement_question_count()
returns trigger as $$
begin
  update public.question_banks
    set question_count = greatest(coalesce(question_count, 0) - 1, 0),
        updated_at = now()
    where id = old.question_bank_id;
  return old;
end;
$$ language plpgsql;

drop trigger if exists questions_after_insert_inc_count on public.questions;
create trigger questions_after_insert_inc_count
after insert on public.questions
for each row execute function public.increment_question_count();

drop trigger if exists questions_after_delete_dec_count on public.questions;
create trigger questions_after_delete_dec_count
after delete on public.questions
for each row execute function public.decrement_question_count();

-- Note: if question_bank_id can change on update, add a transfer trigger (optional).