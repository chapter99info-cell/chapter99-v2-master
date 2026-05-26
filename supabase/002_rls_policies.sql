-- Trip2Talk V4 - 002 RLS policies
-- Part 2/3 of 3. Supabase SQL Editor -> project trip2talk-v4
-- Order: 001_missing_tables -> 002_rls_policies -> 003_seed_data

-- -- 04-anon-booking-rls.sql --
-- Chapter99 V4 — Anon key policies for POS + Booking Wizard
-- Run in Supabase SQL Editor after phase 1–3 schemas
--
-- Existing policies use current_setting('app.shop_id') which the browser
-- never sets. These policies allow the anon key when the app filters by shop_id.

-- ── staff (read for Booking Wizard + Staff Manager) ─────────────────────
-- Prefer supabase/12-staff-manager-rls.sql (drops shop_isolation, all shop staff).
drop policy if exists "anon_select_active_staff" on staff;
drop policy if exists "anon_select_staff" on staff;
create policy "anon_select_staff" on staff
  for select to anon, authenticated
  using (shop_id is not null);

drop policy if exists "anon_insert_staff" on staff;
create policy "anon_insert_staff" on staff
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_staff" on staff;
create policy "anon_update_staff" on staff
  for update to anon, authenticated
  using (true)
  with check (true);

-- ── services (POS + Booking Wizard + Services Manager) ─────────────────
drop policy if exists "anon_select_active_services" on services;
create policy "anon_select_active_services" on services
  for select to anon, authenticated
  using (active = true);

drop policy if exists "anon_insert_services" on services;
create policy "anon_insert_services" on services
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_services" on services;
create policy "anon_update_services" on services
  for update to anon, authenticated
  using (true)
  with check (true);

drop policy if exists "anon_delete_services" on services;
create policy "anon_delete_services" on services
  for delete to anon, authenticated
  using (true);

-- ── bookings (slot availability + new booking) ─────────────────────────
drop policy if exists "anon_select_bookings" on bookings;
create policy "anon_select_bookings" on bookings
  for select to anon, authenticated
  using (status is distinct from 'cancelled');

drop policy if exists "anon_insert_bookings" on bookings;
create policy "anon_insert_bookings" on bookings
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_bookings" on bookings;
create policy "anon_update_bookings" on bookings
  for update to anon, authenticated
  using (true)
  with check (true);

-- ── clients (new booking client record) ──────────────────────────────────
drop policy if exists "anon_select_clients" on clients;
create policy "anon_select_clients" on clients
  for select to anon, authenticated
  using (true);

drop policy if exists "anon_insert_clients" on clients;
create policy "anon_insert_clients" on clients
  for insert to anon, authenticated
  with check (shop_id is not null);

-- ── shops (read shop row for config) ───────────────────────────────────
drop policy if exists "anon_select_shops" on shops;
create policy "anon_select_shops" on shops
  for select to anon, authenticated
  using (true);

drop policy if exists "anon_insert_shops" on shops;
create policy "anon_insert_shops" on shops
  for insert to anon, authenticated
  with check (true);

drop policy if exists "anon_update_shops" on shops;
create policy "anon_update_shops" on shops
  for update to anon, authenticated
  using (true)
  with check (true);

-- -- 08-anon-transactions-rls.sql --
-- Chapter99 V4 — Anon read/write for transactions (POS sync + Owner revenue dashboard)
-- Run in Supabase SQL Editor if revenue summary returns empty or permission errors.

drop policy if exists "anon_select_transactions" on transactions;
create policy "anon_select_transactions" on transactions
  for select to anon, authenticated
  using (shop_id is not null);

drop policy if exists "anon_insert_transactions" on transactions;
create policy "anon_insert_transactions" on transactions
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_transactions" on transactions;
create policy "anon_update_transactions" on transactions
  for update to anon, authenticated
  using (true)
  with check (true);

-- -- 11-storage-logo-policy.sql --
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

-- -- 12-staff-manager-rls.sql --
-- Chapter99 V4 — Staff Manager: fix anon RLS + PIN hashing
-- Run in Supabase SQL Editor if staff list is empty or Add Staff fails.
--
-- Cause: legacy "shop_isolation" uses current_setting('app.shop_id') which the
-- browser never sets, blocking anon reads/writes even when 04-anon policies exist.

create extension if not exists pgcrypto;

-- Remove legacy policy (blocks anon when app.shop_id is unset)
drop policy if exists "shop_isolation" on staff;

-- SELECT — Staff Manager needs all staff for this shop (active + inactive)
drop policy if exists "anon_select_active_staff" on staff;
drop policy if exists "anon_select_staff" on staff;
create policy "anon_select_staff" on staff
  for select to anon, authenticated
  using (shop_id is not null);

-- INSERT / UPDATE — Staff Manager CRUD
drop policy if exists "anon_insert_staff" on staff;
create policy "anon_insert_staff" on staff
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_staff" on staff;
create policy "anon_update_staff" on staff
  for update to anon, authenticated
  using (true)
  with check (true);

-- Hash 4-digit PIN on insert / PIN change (requires pgcrypto)
create or replace function hash_staff_pin()
returns trigger
language plpgsql
as $$
begin
  if new.pin_hash is not null and new.pin_hash ~ '^\d{4}$' then
    new.pin_hash := crypt(new.pin_hash, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists staff_pin_hash on staff;
create trigger staff_pin_hash
  before insert or update of pin_hash on staff
  for each row execute function hash_staff_pin();

-- -- 36-services-manager-rls.sql --
-- Chapter99 V4 — Services Manager: fix anon RLS (delete / hide / list)
-- Run in Supabase SQL Editor if Delete or Hide does nothing in Owner → Services.
--
-- Legacy shop_isolation uses current_setting('app.shop_id') which the browser never sets.
-- anon_select_active_services only returns active rows, so Hide/Delete can look broken in the manager.

drop policy if exists "shop_isolation" on services;

drop policy if exists "anon_select_services_shop" on services;
create policy "anon_select_services_shop" on services
  for select to anon, authenticated
  using (shop_id is not null);

