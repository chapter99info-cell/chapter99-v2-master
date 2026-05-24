-- Booking reminders, cancellation metadata, terms agreement (public online booking)

alter table bookings
  add column if not exists reminder_sent_at timestamptz;

alter table bookings
  add column if not exists cancellation_token text;

alter table bookings
  add column if not exists cancelled_at timestamptz;

alter table bookings
  add column if not exists cancellation_reason text;

alter table bookings
  add column if not exists terms_agreed boolean default false;

alter table bookings
  add column if not exists terms_agreed_at timestamptz;

comment on column bookings.reminder_sent_at is 'When 24h reminder SMS was sent (null = not sent)';
comment on column bookings.cancellation_token is 'Optional token for public cancel links';
comment on column bookings.cancelled_at is 'When the booking was cancelled';
comment on column bookings.cancellation_reason is 'Client-provided cancellation reason';
comment on column bookings.terms_agreed is 'Client accepted Terms and Privacy at booking time';
comment on column bookings.terms_agreed_at is 'When terms were accepted';
