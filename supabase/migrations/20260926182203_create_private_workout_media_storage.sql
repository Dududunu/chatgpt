insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-media', 'workout-media', false, 26214400, array['image/jpeg', 'image/webp'])
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists workout_media_select_own on storage.objects;
drop policy if exists workout_media_insert_own on storage.objects;
drop policy if exists workout_media_update_own on storage.objects;
drop policy if exists workout_media_delete_own on storage.objects;

create policy workout_media_select_own
on storage.objects for select to authenticated
using (
  bucket_id = 'workout-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) ~ '^photo-[A-Za-z0-9_-]+[.](webp|jpe?g)$'
);

create policy workout_media_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'workout-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) ~ '^photo-[A-Za-z0-9_-]+[.](webp|jpe?g)$'
);

create policy workout_media_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'workout-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) ~ '^photo-[A-Za-z0-9_-]+[.](webp|jpe?g)$'
)
with check (
  bucket_id = 'workout-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) ~ '^photo-[A-Za-z0-9_-]+[.](webp|jpe?g)$'
);

create policy workout_media_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'workout-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and cardinality(storage.foldername(name)) = 2
  and storage.filename(name) ~ '^photo-[A-Za-z0-9_-]+[.](webp|jpe?g)$'
);
