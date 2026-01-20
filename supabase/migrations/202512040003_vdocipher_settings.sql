-- Create per-user VdoCipher settings table
create table if not exists public.vdocipher_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  api_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.vdocipher_settings enable row level security;

-- Policies: users manage only their own settings
create policy vdocipher_settings_select on public.vdocipher_settings
  for select to authenticated using (user_id = auth.uid());

create policy vdocipher_settings_insert on public.vdocipher_settings
  for insert to authenticated with check (user_id = auth.uid());

create policy vdocipher_settings_update on public.vdocipher_settings
  for update to authenticated using (user_id = auth.uid());

create policy vdocipher_settings_delete on public.vdocipher_settings
  for delete to authenticated using (user_id = auth.uid());

-- Trigger to keep updated_at fresh
create or replace function public.set_updated_at_vdocipher_settings()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at_vdocipher_settings on public.vdocipher_settings;
create trigger set_updated_at_vdocipher_settings
before update on public.vdocipher_settings
for each row execute function public.set_updated_at_vdocipher_settings();

