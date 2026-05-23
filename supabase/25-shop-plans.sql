-- Subscription plan + add-on flags (Super Admin managed)
-- Plan tiers: starter | growth | pro

alter table shops
  add column if not exists addon_stripe boolean not null default false,
  add column if not exists addon_sms boolean not null default false,
  add column if not exists addon_website boolean not null default false,
  add column if not exists addon_reports boolean not null default false;

-- Migrate legacy plan names before constraint
update shops set plan = 'growth' where plan = 'professional';
update shops set plan = 'pro' where plan in ('business', 'business_plus');

alter table shops alter column plan set default 'starter';

alter table shops drop constraint if exists shops_plan_check;

alter table shops
  add constraint shops_plan_check
  check (plan in ('starter', 'growth', 'pro'));

comment on column shops.plan is 'starter | growth | pro';
comment on column shops.addon_stripe is 'Add-on: Stripe payments (public vouchers, etc.)';
comment on column shops.addon_sms is 'Add-on: SMS notifications';
comment on column shops.addon_website is 'Add-on: Website builder / public site tools';
comment on column shops.addon_reports is 'Add-on: Reports & CSV export';
