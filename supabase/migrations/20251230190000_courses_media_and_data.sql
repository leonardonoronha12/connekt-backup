alter table public.courses
  add column if not exists cover_image_url text,
  add column if not exists promo_video_url text,
  add column if not exists module_layout_image_url text,
  add column if not exists data jsonb default '{}'::jsonb;

insert into storage.buckets (id, name, public)
values ('courses-media', 'courses-media', true)
on conflict (id) do update set public = excluded.public;

do $$
begin
  begin
    update storage.buckets
      set allowed_mime_types = array['image/*','video/*']
      where id = 'courses-media';
  exception when undefined_column then
    null;
  end;

  begin
    update storage.buckets
      set file_size_limit = 1073741824
      where id = 'courses-media';
  exception when undefined_column then
    null;
  end;
end $$;

drop policy if exists "courses-media select public" on storage.objects;
create policy "courses-media select public"
on storage.objects
for select
to public
using (bucket_id = 'courses-media');

drop policy if exists "courses-media insert authenticated" on storage.objects;
create policy "courses-media insert authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'courses-media'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "courses-media update authenticated" on storage.objects;
create policy "courses-media update authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'courses-media'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
)
with check (
  bucket_id = 'courses-media'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);

drop policy if exists "courses-media delete authenticated" on storage.objects;
create policy "courses-media delete authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'courses-media'
  and (storage.foldername(name))[1] = 'users'
  and (storage.foldername(name))[2] = auth.uid()::text
);
