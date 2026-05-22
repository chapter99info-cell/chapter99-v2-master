-- Chapter99 — Denormalized therapist name on bookings (staff dashboard wizard)

alter table bookings add column if not exists therapist_name text;
