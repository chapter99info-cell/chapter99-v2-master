-- Remove all Gold Coast / GC trips (keep New Zealand + Sydney only)

delete from tour_bookings
where tour_id in (
  select id from tours
  where destination ilike '%gold coast%'
     or trip_code ilike 'GC-%'
     or trip_code ilike 'GC_%'
     or trip_code ~* '^GC[-_]'
);

delete from staff_commission_ledger
where tour_id in (
  select id from tours
  where destination ilike '%gold coast%'
     or trip_code ilike 'GC-%'
     or trip_code ilike 'GC_%'
     or trip_code ~* '^GC[-_]'
);

delete from expenses
where tour_id in (
  select id::text from tours
  where destination ilike '%gold coast%'
     or trip_code ilike 'GC-%'
     or trip_code ilike 'GC_%'
     or trip_code ~* '^GC[-_]'
);

delete from tour_itinerary_blocks
where day_id in (
  select d.id from tour_itinerary_days d
  join tours t on t.id = d.tour_id
  where t.destination ilike '%gold coast%'
     or t.trip_code ilike 'GC-%'
     or t.trip_code ilike 'GC_%'
     or t.trip_code ~* '^GC[-_]'
);

delete from tour_itinerary_days
where tour_id in (
  select id from tours
  where destination ilike '%gold coast%'
     or trip_code ilike 'GC-%'
     or trip_code ilike 'GC_%'
     or trip_code ~* '^GC[-_]'
);

delete from tours
where destination ilike '%gold coast%'
   or trip_code ilike 'GC-%'
   or trip_code ilike 'GC_%'
   or trip_code ~* '^GC[-_]';

delete from trip_gallery where dest ilike '%gold coast%';

delete from client_guide_content where dest ilike '%gold coast%';

delete from offline_map_pins where dest ilike '%gold coast%';

delete from emergency_contacts where dest ilike '%gold coast%';

delete from packing_items where dest ilike '%gold coast%';

-- Restrict destinations to NZ + Sydney only
alter table tours drop constraint if exists tours_destination_check;
alter table tours add constraint tours_destination_check
  check (destination in ('New Zealand', 'Sydney'));
