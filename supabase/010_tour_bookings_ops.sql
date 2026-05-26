-- Staff check-in + cashier history fields

alter table tour_bookings
  add column if not exists is_checked_in boolean not null default false,
  add column if not exists booked_at timestamptz default now(),
  add column if not exists payment_method text;

update tour_bookings set booked_at = coalesce(booked_at, created_at) where booked_at is null;

drop policy if exists "anon_update_bookings" on tour_bookings;
create policy "anon_update_bookings" on tour_bookings for update to anon using (true) with check (true);
