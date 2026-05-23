-- Hero / logo / service images — bucket paths: shops/{shop_id}/hero.{ext}
-- Run after 11-storage-logo-policy.sql and 24-shop-website-images.sql

alter table shops
  add column if not exists hero_image_url text;

alter table services
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-assets',
  'shop-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop_assets_select" on storage.objects;
drop policy if exists "shop_assets_insert" on storage.objects;
drop policy if exists "shop_assets_update" on storage.objects;
drop policy if exists "shop_assets_delete" on storage.objects;

create policy "shop_assets_select"
on storage.objects for select to public
using (bucket_id = 'shop-assets');

-- shops/{shop_id}/… or legacy {shop_id}/… paths
create policy "shop_assets_insert"
on storage.objects for insert to public
with check (
  bucket_id = 'shop-assets'
  and (
    (storage.foldername(name))[1] = 'shops'
    or (storage.foldername(name))[1] is not null
  )
);

create policy "shop_assets_update"
on storage.objects for update to public
using (bucket_id = 'shop-assets')
with check (
  bucket_id = 'shop-assets'
  and (
    (storage.foldername(name))[1] = 'shops'
    or (storage.foldername(name))[1] is not null
  )
);

create policy "shop_assets_delete"
on storage.objects for delete to public
using (bucket_id = 'shop-assets');
