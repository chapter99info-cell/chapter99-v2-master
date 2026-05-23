-- Chapter99 V4 — Owner notification email for new booking alerts
alter table shops add column if not exists notification_email text;

comment on column shops.notification_email is
  'Email address that receives new booking confirmation alerts for the shop';
