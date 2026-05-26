-- Content generator: public gallery bucket + upload policies
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'gallery',
  'gallery',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "gallery authenticated upload" on storage.objects;
create policy "gallery authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'gallery');

drop policy if exists "gallery authenticated update" on storage.objects;
create policy "gallery authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'gallery');

drop policy if exists "gallery public read" on storage.objects;
create policy "gallery public read"
  on storage.objects for select
  to public
  using (bucket_id = 'gallery');
