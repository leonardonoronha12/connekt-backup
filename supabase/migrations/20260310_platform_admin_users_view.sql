create or replace view public.platform_admin_users as
select
  u.id::text as id,
  u.email::text as email,
  u.created_at,
  u.last_sign_in_at,
  u.banned_until,
  coalesce(
    u.raw_user_meta_data->>'name',
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'profile_full_name',
    u.raw_user_meta_data->>'display_name',
    ''
  ) as name,
  coalesce(
    u.raw_user_meta_data->>'account_type',
    u.raw_user_meta_data->>'role',
    u.raw_user_meta_data->>'platform_role',
    u.raw_user_meta_data->>'type',
    ''
  ) as account_type
from auth.users u;

grant select on public.platform_admin_users to service_role;

