-- Public site page visibility per shop (multi-tenant storefront)

alter table shops
  add column if not exists page_home_enabled boolean not null default true,
  add column if not exists page_services_enabled boolean not null default true,
  add column if not exists page_vouchers_enabled boolean not null default true,
  add column if not exists page_about_enabled boolean not null default true,
  add column if not exists disabled_redirect_path text not null default '/book';

comment on column shops.page_home_enabled is 'Show public home page (/)';
comment on column shops.page_services_enabled is 'Show public services/menu page';
comment on column shops.page_vouchers_enabled is 'Show public gift voucher page';
comment on column shops.page_about_enabled is 'Show public about page';
comment on column shops.disabled_redirect_path is 'Path when a disabled page is visited, e.g. /book';
