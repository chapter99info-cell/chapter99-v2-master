-- Public website images (hero, logo uses shops.logo_url, per-service photos)

alter table shops
  add column if not exists hero_image_url text;

alter table services
  add column if not exists image_url text;

comment on column shops.hero_image_url is 'Home page hero banner image URL (shop-assets bucket)';
comment on column services.image_url is 'Public services/menu listing photo';
