-- Trip2Talk photo gallery metadata + storage bucket

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-gallery',
  'trip-gallery',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

create table if not exists trip_gallery (
  id uuid primary key default uuid_generate_v4(),
  storage_path text not null unique,
  caption_th text not null,
  caption_en text not null,
  dest text not null,
  sort_order int not null default 0,
  camera_metadata jsonb not null default '{}',
  created_at timestamptz default now()
);

create index if not exists trip_gallery_dest_idx on trip_gallery (dest, sort_order);

alter table trip_gallery enable row level security;

drop policy if exists "anon_read_trip_gallery" on trip_gallery;
create policy "anon_read_trip_gallery" on trip_gallery for select to anon using (true);

drop policy if exists "anon_read_trip_gallery_storage" on storage.objects;
create policy "anon_read_trip_gallery_storage"
  on storage.objects for select to anon
  using (bucket_id = 'trip-gallery');
