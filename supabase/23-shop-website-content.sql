-- Public website copy (hero + about). Page visibility: 22-shop-page-visibility.sql

alter table shops
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists about_text text,
  add column if not exists about_phone text,
  add column if not exists about_address text,
  add column if not exists google_maps_url text;

comment on column shops.hero_title is 'Public home hero headline (falls back to shop name)';
comment on column shops.hero_subtitle is 'Public home hero subtext';
comment on column shops.about_text is 'Public about page body copy';
comment on column shops.about_phone is 'Public about page phone (falls back to shop phone)';
comment on column shops.about_address is 'Public about page address (falls back to shop address)';
comment on column shops.google_maps_url is 'Google Maps link for about page';
