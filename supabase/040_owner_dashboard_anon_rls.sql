-- Owner dashboard (/owner, PIN 9999) uses browser anon key — not Supabase Auth.
-- Ensure SELECT (and required writes) for KPI / tours / bookings / expenses / commission.

-- tours
drop policy if exists "anon_read_tours" on tours;
create policy "anon_read_tours"
  on tours for select
  to anon, authenticated
  using (true);

-- tour_bookings (CRM bookings — not trip_bookings deposit form)
drop policy if exists "anon_read_bookings" on tour_bookings;
create policy "anon_read_bookings"
  on tour_bookings for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_update_bookings" on tour_bookings;
create policy "anon_update_bookings"
  on tour_bookings for update
  to anon, authenticated
  using (true)
  with check (true);

-- expenses (owner dashboard)
drop policy if exists "anon_read_expenses" on expenses;
create policy "anon_read_expenses"
  on expenses for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_insert_expenses" on expenses;
create policy "anon_insert_expenses"
  on expenses for insert
  to anon, authenticated
  with check (true);

drop policy if exists "anon_update_expenses" on expenses;
create policy "anon_update_expenses"
  on expenses for update
  to anon, authenticated
  using (true)
  with check (true);

-- staff commission ledger
drop policy if exists "anon_read_commission" on staff_commission_ledger;
create policy "anon_read_commission"
  on staff_commission_ledger for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_update_commission" on staff_commission_ledger;
create policy "anon_update_commission"
  on staff_commission_ledger for update
  to anon, authenticated
  using (true)
  with check (true);

-- SYNC tab table counts
drop policy if exists "anon_read_clients" on crm_clients;
create policy "anon_read_clients"
  on crm_clients for select
  to anon, authenticated
  using (true);

drop policy if exists "anon_read_staff" on staff_profiles;
create policy "anon_read_staff"
  on staff_profiles for select
  to anon, authenticated
  using (coalesce(active, true));

drop policy if exists "anon_read_guide" on client_guide_content;
create policy "anon_read_guide"
  on client_guide_content for select
  to anon, authenticated
  using (coalesce(active, true));

drop policy if exists "anon_read_gallery" on gallery;
create policy "anon_read_gallery"
  on gallery for select
  to anon, authenticated
  using (true);

grant select on tours to anon, authenticated;
grant select on tour_bookings to anon, authenticated;
grant select, insert, update on expenses to anon, authenticated;
grant select, update on staff_commission_ledger to anon, authenticated;
grant select on crm_clients to anon, authenticated;
grant select on staff_profiles to anon, authenticated;
grant select on client_guide_content to anon, authenticated;
grant select on gallery to anon, authenticated;
