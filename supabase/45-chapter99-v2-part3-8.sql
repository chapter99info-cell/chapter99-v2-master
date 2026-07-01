-- Chapter99 V2 — PART 3–8 consolidated migrations
-- Run manually in Supabase SQL Editor after prior schema files.

-- PART 3: SMS settings (Super Admin only write via service role)
alter table shops
  add column if not exists sms_enabled boolean not null default false,
  add column if not exists sms_package text not null default 'none';

comment on column shops.sms_enabled is 'SMS enabled by Super Admin toggle only';
comment on column shops.sms_package is 'none | sms_200 | sms_500 | sms_unlimited';

-- PART 3: Real photos flag + theme
alter table shops
  add column if not exists has_real_photos boolean not null default false,
  add column if not exists theme_id text default 'elegant',
  add column if not exists theme_primary_color text;

-- PART 5.1: Flexible deposit config
alter table shops
  add column if not exists deposit_mode text not null default 'off',
  add column if not exists deposit_amount numeric not null default 20,
  add column if not exists deposit_cancel_hours int not null default 24,
  add column if not exists deposit_new_customer_threshold int not null default 1;

comment on column shops.deposit_mode is 'off | all | new_customers_only | weekends_only';

alter table bookings
  add column if not exists deposit_required boolean not null default false,
  add column if not exists deposit_amount numeric,
  add column if not exists deposit_paid boolean not null default false;

-- PART 5.2: Daily report closing time
alter table shops
  add column if not exists daily_report_hour int not null default 20,
  add column if not exists daily_report_timezone text not null default 'Australia/Sydney';

-- PART 5.3: Inventory
create table if not exists inventory_items (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  name text not null,
  unit text not null default 'unit',
  quantity numeric not null default 0,
  qty_min numeric,
  qty_max numeric,
  reorder_threshold numeric not null default 0,
  reorder_url text,
  last_stock_take_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists service_inventory_usage (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references services(id) on delete cascade,
  inventory_item_id uuid not null references inventory_items(id) on delete cascade,
  qty_per_use_min numeric not null default 1,
  qty_per_use_max numeric not null default 1,
  unique (service_id, inventory_item_id)
);

create index if not exists idx_inventory_items_shop on inventory_items(shop_id);

-- PART 5.5: Loyalty + win-back
alter table clients
  add column if not exists loyalty_points int not null default 0,
  add column if not exists winback_sent_at timestamptz,
  add column if not exists date_of_birth date;

alter table shops
  add column if not exists loyalty_points_per_dollar numeric not null default 1;

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid references clients(id) on delete set null,
  shop_id text not null references shops(id) on delete cascade,
  discount_pct numeric not null default 10,
  expires_at timestamptz not null,
  used boolean not null default false,
  created_at timestamptz not null default now()
);

-- PART 5.6: Review sentiment + complaints
alter table shops
  add column if not exists google_review_url text;

create table if not exists complaints (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references shops(id) on delete cascade,
  booking_id uuid references bookings(id) on delete set null,
  client_id uuid references clients(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  message text,
  created_at timestamptz not null default now(),
  resolved boolean not null default false
);

create index if not exists idx_complaints_shop_unresolved on complaints(shop_id) where resolved = false;

alter table bookings
  add column if not exists review_request_sent_at timestamptz,
  add column if not exists review_rating int;

-- PART 8.3: SMS usage tracking
create table if not exists sms_usage (
  shop_id text not null references shops(id) on delete cascade,
  year_month text not null,
  sms_count int not null default 0,
  sms_limit int not null default 0,
  primary key (shop_id, year_month)
);

-- RLS: inventory (owner/service role)
alter table inventory_items enable row level security;
alter table service_inventory_usage enable row level security;
alter table complaints enable row level security;
alter table discount_codes enable row level security;
alter table sms_usage enable row level security;

drop policy if exists inventory_items_shop on inventory_items;
create policy inventory_items_shop on inventory_items
  for all using (true) with check (true);

drop policy if exists complaints_shop on complaints;
create policy complaints_shop on complaints
  for all using (true) with check (true);
