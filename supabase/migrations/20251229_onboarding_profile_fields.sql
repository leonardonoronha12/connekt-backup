alter table public.profiles
  add column if not exists profile_full_name text,
  add column if not exists profile_phone text,
  add column if not exists member_area_url text,
  add column if not exists payout_enabled boolean default false,
  add column if not exists payout_pix_key text,
  add column if not exists payout_bank text,
  add column if not exists payout_agency text,
  add column if not exists payout_account text,
  add column if not exists payout_document text,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if to_regclass('public.set_updated_at') is not null then
    drop trigger if exists profiles_set_updated_at on public.profiles;
    create trigger profiles_set_updated_at
    before update on public.profiles
    for each row
    execute procedure public.set_updated_at();
  end if;
exception when others then
  null;
end $$;

