-- Chapter99 — Assign rooms to bookings via room_id FK

alter table bookings
  add column if not exists room_id uuid references rooms(id) on delete set null;

create index if not exists bookings_room_id on bookings(room_id);
