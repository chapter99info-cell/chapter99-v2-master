-- Chapter99 V4 — Anon key policies for POS + Booking Wizard
-- Run in Supabase SQL Editor after phase 1–3 schemas
--
-- Existing policies use current_setting('app.shop_id') which the browser
-- never sets. These policies allow the anon key when the app filters by shop_id.

-- ── staff (read for Booking Wizard, CRUD for Staff Manager) ─────────────
drop policy if exists "anon_select_active_staff" on staff;
create policy "anon_select_active_staff" on staff
  for select to anon, authenticated
  using (active = true);

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
