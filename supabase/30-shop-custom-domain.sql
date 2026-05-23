-- Custom domain per shop (e.g. mira-thai-massage.com.au)
-- Map host → slug in Vercel SHOP_DOMAIN_MAP / VITE_SHOP_DOMAIN_MAP

alter table shops
  add column if not exists domain text;

create unique index if not exists shops_domain_unique
  on shops (lower(domain))
  where domain is not null and domain <> '';

comment on column shops.domain is 'Custom hostname without protocol, e.g. mira-thai-massage.com.au';
