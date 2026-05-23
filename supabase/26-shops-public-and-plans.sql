-- Consolidated shops columns: public pages, website copy, subscription plan + add-ons
-- Safe to re-run in Supabase SQL editor (IF NOT EXISTS)

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
  add column if not exists google_maps_url text,
  add column if not exists plan text default 'starter',
  add column if not exists addon_stripe boolean default false,
  add column if not exists addon_sms boolean default false,
  add column if not exists addon_website boolean default false,
  add column if not exists addon_reports boolean default false;

-- Legacy plan names → new tiers
update shops set plan = 'growth' where plan = 'professional';
update shops set plan = 'pro' where plan in ('business', 'business_plus');

alter table shops alter column plan set default 'starter';

alter table shops drop constraint if exists shops_plan_check;

alter table shops
  add constraint shops_plan_check
  check (plan in ('starter', 'growth', 'pro'));

comment on column shops.page_home_enabled is 'Show public home page (/)';
comment on column shops.page_services_enabled is 'Show public services/menu page';
comment on column shops.page_vouchers_enabled is 'Show public gift voucher page';
comment on column shops.page_about_enabled is 'Show public about page';
comment on column shops.disabled_redirect_path is 'Redirect when a disabled page is visited, e.g. /book';
comment on column shops.plan is 'starter | growth | pro';
comment on column shops.addon_stripe is 'Add-on: Stripe payments (public vouchers, etc.)';
comment on column shops.addon_sms is 'Add-on: SMS notifications';
comment on column shops.addon_website is 'Add-on: Website builder / public site tools';
comment on column shops.addon_reports is 'Add-on: Reports & CSV export';
