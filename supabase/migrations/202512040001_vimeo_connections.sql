create table if not exists public.vimeo_connections (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_token text not null,
  scope text,
  token_type text,
  vimeo_user_uri text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

comment on table public.vimeo_connections is 'Armazena tokens OAuth do Vimeo por usuário';
comment on column public.vimeo_connections.access_token is 'Access token retornado pelo Vimeo';

