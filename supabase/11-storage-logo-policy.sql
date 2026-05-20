-- Chapter99 V4 — Fix Storage RLS for shop logos & signatures
-- Run in Supabase SQL Editor if logo upload fails with:
--   "new row violates row-level security policy"
--
-- App uploads to bucket: shop-assets  (paths: {shop_id}/logo-*.ext, {shop_id}/signature-*.ext)
-- Uses anon key from the PWA (PIN login is app-level, not Supabase Auth).

-- ── Bucket (public URLs for receipts / settings preview) ───────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-assets',
  'shop-assets',
  true,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Remove prior / conflicting policies (05-receipt-system + defaults) ──
drop policy if exists "shop_assets_public_read" on storage.objects;
drop policy if exists "shop_assets_anon_upload" on storage.objects;
drop policy if exists "shop_assets_anon_update" on storage.objects;
drop policy if exists "shop_assets_select" on storage.objects;
drop policy if exists "shop_assets_insert" on storage.objects;
drop policy if exists "shop_assets_update" on storage.objects;
drop policy if exists "shop_assets_delete" on storage.objects;

-- ── storage.objects RLS (public = anon + authenticated + all roles) ──
-- SELECT — read / getPublicUrl
create policy "shop_assets_select"
on storage.objects
for select
to public
using (bucket_id = 'shop-assets');

-- INSERT — new logo / signature upload
create policy "shop_assets_insert"
on storage.objects
for insert
to public
with check (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] is not null
);

-- UPDATE — required when upload uses upsert: true
create policy "shop_assets_update"
on storage.objects
for update
to public
using (bucket_id = 'shop-assets')
with check (
  bucket_id = 'shop-assets'
  and (storage.foldername(name))[1] is not null
);

-- DELETE — replace / remove assets
create policy "shop_assets_delete"
on storage.objects
for delete
to public
using (bucket_id = 'shop-assets');
