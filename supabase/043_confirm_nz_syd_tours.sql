-- Ensure NZ + Sydney tours appear in TRIP tab (fetchPublicTours prefers status = CONFIRMED)

-- Upsert flagship NZ tour if missing
insert into tours (
  trip_code, destination, start_date, end_date, price_aud, max_pax, current_pax, status
)
values (
  'NZ-AUT-2026', 'New Zealand', '2026-06-15', '2026-06-28', 2499, 20, 0, 'CONFIRMED'
)
on conflict (trip_code) do update set
  destination = excluded.destination,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  status = 'CONFIRMED';

-- All NZ + Sydney tours (not cancelled) → CONFIRMED for public TRIP / onboarding lists
update tours
set status = 'CONFIRMED'
where destination in ('New Zealand', 'Sydney')
  and status is distinct from 'CANCELLED'
  and status is distinct from 'CONFIRMED';
