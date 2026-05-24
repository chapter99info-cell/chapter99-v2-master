-- Privacy policy and terms of service links for public footer

alter table shops
  add column if not exists privacy_policy_url text,
  add column if not exists terms_url text;

comment on column shops.privacy_policy_url is 'External privacy policy URL for public footer';
comment on column shops.terms_url is 'External terms of service URL for public footer';
