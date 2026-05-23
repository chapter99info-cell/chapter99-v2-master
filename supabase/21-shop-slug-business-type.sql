-- Multi-shop URL routing: ?shop=mira → shops.slug → shops.id
-- Business context isolation: massage vs restaurant UI

alter table shops
  add column if not exists slug text,
  add column if not exists business_type text not null default 'massage'
    check (business_type in ('massage', 'restaurant'));

create unique index if not exists shops_slug_unique on shops (slug) where slug is not null;

comment on column shops.slug is 'Public URL key, e.g. mira for ?shop=mira';
comment on column shops.business_type is 'massage | restaurant — drives public booking UI';

-- Example seed (adjust id/slug to match your shops row)
-- update shops set slug = 'mira', business_type = 'massage' where id = 'shop-001';
