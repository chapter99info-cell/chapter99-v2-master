-- Trip2Talk anon-friendly RLS (run after 004_trip2talk_tables.sql)
-- Safe if staff_profiles / client_guide_content were created earlier without "active"

alter table staff_profiles add column if not exists active boolean default true;
alter table client_guide_content add column if not exists active boolean default true;

update staff_profiles set active = true where active is null;
update client_guide_content set active = true where active is null;

drop policy if exists "anon_read_tours" on tours;
drop policy if exists "anon_insert_clients" on crm_clients;
drop policy if exists "anon_read_clients" on crm_clients;
drop policy if exists "anon_insert_waivers" on waivers;
drop policy if exists "anon_read_bookings" on tour_bookings;
drop policy if exists "anon_insert_bookings" on tour_bookings;
drop policy if exists "anon_read_guide" on client_guide_content;
drop policy if exists "anon_read_reviews" on reviews;
drop policy if exists "anon_read_gallery" on gallery;
drop policy if exists "anon_gallery_likes" on gallery_likes;
drop policy if exists "anon_update_gallery_likes" on gallery;
drop policy if exists "anon_read_packing" on packing_items;
drop policy if exists "anon_read_itinerary_days" on tour_itinerary_days;
drop policy if exists "anon_read_itinerary_blocks" on tour_itinerary_blocks;
drop policy if exists "anon_read_map_pins" on offline_map_pins;
drop policy if exists "anon_read_emergency" on emergency_contacts;
drop policy if exists "anon_read_staff" on staff_profiles;

create policy "anon_read_tours" on tours for select to anon using (true);
create policy "anon_insert_clients" on crm_clients for insert to anon with check (true);
create policy "anon_read_clients" on crm_clients for select to anon using (true);
create policy "anon_insert_waivers" on waivers for insert to anon with check (true);
create policy "anon_read_bookings" on tour_bookings for select to anon using (true);
create policy "anon_insert_bookings" on tour_bookings for insert to anon with check (true);
create policy "anon_read_guide" on client_guide_content for select to anon using (coalesce(active, true));
create policy "anon_read_reviews" on reviews for select to anon using (is_published = true);
create policy "anon_read_gallery" on gallery for select to anon using (true);
create policy "anon_gallery_likes" on gallery_likes for all to anon using (true) with check (true);
create policy "anon_update_gallery_likes" on gallery for update to anon using (true);
create policy "anon_read_packing" on packing_items for select to anon using (true);
create policy "anon_read_itinerary_days" on tour_itinerary_days for select to anon using (true);
create policy "anon_read_itinerary_blocks" on tour_itinerary_blocks for select to anon using (true);
create policy "anon_read_map_pins" on offline_map_pins for select to anon using (true);
create policy "anon_read_emergency" on emergency_contacts for select to anon using (true);
create policy "anon_read_staff" on staff_profiles for select to anon using (coalesce(active, true));
