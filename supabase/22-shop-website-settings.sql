-- Combined website settings (safe to re-run; complements 22-shop-page-visibility + 23-shop-website-content)

alter table shops
  add column if not exists page_home_enabled boolean default true,
  add column if not exists page_services_enabled boolean default true,
  add column if not exists page_vouchers_enabled boolean default true,
  add column if not exists page_about_enabled boolean default true,
  add column if not exists disabled_redirect_path text default '/book',
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists about_text text,
  add column if not exists about_phone text,
  add column if not exists about_address text,
  add column if not exists google_maps_url text;
