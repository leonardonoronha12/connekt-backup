-- Create table to store per-user Vimeo app credentials
create table if not exists public.vimeo_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  client_id text not null,
  client_secret text not null,
  redirect_uri text not null,
  scope text not null default 'public private upload video_files',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.vimeo_settings enable row level security;

-- Policies: user can view and manage own settings
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vimeo_settings'
      and policyname = 'vimeo_settings_select_own'
  ) then
    create policy "vimeo_settings_select_own"
      on public.vimeo_settings for select
      to authenticated
      using ( auth.uid() = user_id );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vimeo_settings'
      and policyname = 'vimeo_settings_upsert_own'
  ) then
    create policy "vimeo_settings_upsert_own"
      on public.vimeo_settings for insert
      to authenticated
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vimeo_settings'
      and policyname = 'vimeo_settings_update_own'
  ) then
    create policy "vimeo_settings_update_own"
      on public.vimeo_settings for update
      to authenticated
      using ( auth.uid() = user_id )
      with check ( auth.uid() = user_id );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'vimeo_settings'
      and policyname = 'vimeo_settings_delete_own'
  ) then
    create policy "vimeo_settings_delete_own"
      on public.vimeo_settings for delete
      to authenticated
      using ( auth.uid() = user_id );
  end if;
end $$;

-- Trigger to update updated_at
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_vimeo_settings_updated_at on public.vimeo_settings;
create trigger trg_vimeo_settings_updated_at
before update on public.vimeo_settings
for each row execute function public.touch_updated_at();
