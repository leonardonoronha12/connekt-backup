alter table public.profiles
  add column if not exists active_device_id text,
  add column if not exists active_device_label text,
  add column if not exists active_device_user_agent text,
  add column if not exists active_device_last_seen_at timestamptz,
  add column if not exists active_device_expires_at timestamptz;

