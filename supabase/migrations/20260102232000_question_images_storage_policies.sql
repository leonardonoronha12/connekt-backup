do $$
begin
  begin
    execute 'set local role supabase_storage_admin';
  exception when others then
    begin
      execute 'set local role supabase_admin';
    exception when others then
      null;
    end;
  end;
end $$;

do $$
begin
  if not exists (select 1 from storage.buckets where id = 'question-images') then
    insert into storage.buckets (id, name, public)
    values ('question-images', 'question-images', true);
  else
    update storage.buckets set public = true where id = 'question-images';
  end if;
end $$;

alter table storage.objects enable row level security;

drop policy if exists "question-images: insert own folder" on storage.objects;
create policy "question-images: insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question-images: read own folder" on storage.objects;
create policy "question-images: read own folder"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question-images: update own folder" on storage.objects;
create policy "question-images: update own folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "question-images: delete own folder" on storage.objects;
create policy "question-images: delete own folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'question-images'
  and (storage.foldername(name))[1] = auth.uid()::text
);
