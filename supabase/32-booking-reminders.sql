-- Booking reminder SMS tracking (24h before appointment)

alter table bookings
  add column if not exists reminder_sent_at timestamptz;

comment on column bookings.reminder_sent_at is 'When 24h reminder SMS was sent (null = not sent)';
