-- Google Review Request after POS checkout

alter table shops
  add column if not exists review_request_enabled boolean default false;

alter table shops
  add column if not exists google_review_url text;

alter table shops
  add column if not exists review_request_channel text default 'email';

-- Normalize channel values (safe if column already exists without check)
update shops
set review_request_channel = 'email'
where review_request_channel is null
   or review_request_channel not in ('email', 'sms', 'both');

alter table shops
  drop constraint if exists shops_review_request_channel_check;

alter table shops
  add constraint shops_review_request_channel_check
  check (review_request_channel in ('email', 'sms', 'both'));

alter table clients
  add column if not exists last_review_request_sent timestamptz;

comment on column shops.review_request_enabled is 'Send Google review request after POS payment';
comment on column shops.review_request_channel is 'email | sms | both';
comment on column clients.last_review_request_sent is 'Last automated review request (30-day rate limit)';
