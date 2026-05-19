-- Chapter99 V4 — Phase 5 Database Schema
-- Supabase PostgreSQL + Row Level Security
-- Run in Supabase SQL Editor

-- ── Extensions ────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Shops ─────────────────────────────────────────────────────
create table shops (
  id              text primary key,
  name            text not null,
  abn             text,
  address         text,
  phone           text,
  email           text,
  plan            text not null default 'starter',
  gst_registered  boolean default true,
  currency        text default 'AUD',
  timezone        text default 'Australia/Sydney',
  provider_name   text,
  provider_number text,
  signature_url   text,
  card_surcharge  numeric(5,4) default 0.015,
  amex_surcharge  numeric(5,4) default 0.02,
  payid_bsb       text,
  payid_account   text,
  stripe_pub_key  text,
  active          boolean default true,
  created_at      timestamptz default now()
);

-- ── Services ──────────────────────────────────────────────────
create table services (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text references shops(id) on delete cascade,
  name_en     text not null,
  name_th     text,
  duration    int not null,              -- minutes
  price       numeric(8,2) not null,
  gst_free    boolean default false,
  item_no     text,                      -- Health Fund item number
  category    text default 'other',
  active      boolean default true,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- ── Staff ─────────────────────────────────────────────────────
create table staff (
  id                  uuid primary key default uuid_generate_v4(),
  shop_id             text references shops(id) on delete cascade,
  name_en             text not null,
  name_th             text,
  role                text not null default 'therapist',
  pin_hash            text not null,
  commission_rate     numeric(4,2) default 0.40,
  base_hourly         numeric(6,2),
  active              boolean default true,
  -- Documents
  visa_type           text,
  visa_expiry         date,
  tfn_encrypted       text,
  super_fund          text,
  super_member_enc    text,
  -- Insurance
  indemnity_expiry    date,
  liability_expiry    date,
  firstaid_expiry     date,
  -- Employment
  employment_type     text default 'casual',
  start_date          date,
  probation_end       date,
  created_at          timestamptz default now()
);

-- ── Clients ───────────────────────────────────────────────────
create table clients (
  id                uuid primary key default uuid_generate_v4(),
  shop_id           text references shops(id) on delete cascade,
  name              text not null,
  email             text,
  phone             text,
  dob               date,
  address           text,
  health_fund       text,
  health_fund_name  text,
  -- Medical (from intake form)
  medical_flags     jsonb default '[]',
  allergies         text,
  -- Preferences
  pressure_pref     int default 2,       -- 1 soft, 2 medium, 3 deep
  focus_areas       jsonb default '[]',
  notes             text,
  -- Membership
  package_balance   int default 0,
  total_visits      int default 0,
  last_visit        date,
  created_at        timestamptz default now()
);

-- ── Bookings ──────────────────────────────────────────────────
create table bookings (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         text references shops(id) on delete cascade,
  client_id       uuid references clients(id),
  service_id      uuid references services(id),
  staff_id        uuid references staff(id),
  start_time      timestamptz not null,
  end_time        timestamptz not null,
  status          text default 'confirmed',
  -- Client preferences (captured at booking)
  pressure_pref   int,
  focus_areas     jsonb,
  medical_notes   text,
  -- Source
  source          text default 'online',  -- online/walkin/phone
  booked_by       text,                   -- staff name if phone-in
  -- Lock
  slot_locked_at  timestamptz,
  slot_locked_by  text,
  created_at      timestamptz default now()
);

-- Prevent double-booking (no overlapping bookings for same staff)
create unique index booking_no_overlap
  on bookings (staff_id, start_time, end_time)
  where status != 'cancelled';

-- ── Transactions ──────────────────────────────────────────────
create table transactions (
  id                  text primary key,  -- e.g. TBM-2026-00123
  shop_id             text references shops(id),
  booking_id          uuid references bookings(id),
  client_id           uuid references clients(id),
  client_name         text,
  client_email        text,
  therapist_id        uuid references staff(id),
  therapist_name      text,
  -- Items (JSONB array of BillItem)
  items               jsonb not null default '[]',
  -- Payment breakdown
  payment             jsonb not null,
  payment_method      text not null,
  status              text default 'paid',
  -- Timestamps
  created_at          timestamptz default now(),
  paid_at             timestamptz,
  voided_at           timestamptz,
  void_reason         text,
  -- Flags
  receipt_sent        boolean default false,
  health_fund_issued  boolean default false,
  synced_sheet        boolean default false
);

-- ── Indexes for reporting ──────────────────────────────────────
create index tx_shop_date on transactions(shop_id, paid_at desc);
create index tx_status on transactions(shop_id, status);
create index booking_shop_date on bookings(shop_id, start_time);
create index booking_staff on bookings(staff_id, start_time);

-- ── Row Level Security ─────────────────────────────────────────
alter table shops         enable row level security;
alter table services      enable row level security;
alter table staff         enable row level security;
alter table clients       enable row level security;
alter table bookings      enable row level security;
alter table transactions  enable row level security;

-- Staff sees only their shop
create policy "shop_isolation" on services
  using (shop_id = current_setting('app.shop_id', true));

create policy "shop_isolation" on staff
  using (shop_id = current_setting('app.shop_id', true));

create policy "shop_isolation" on clients
  using (shop_id = current_setting('app.shop_id', true));

create policy "shop_isolation" on bookings
  using (shop_id = current_setting('app.shop_id', true));

create policy "shop_isolation" on transactions
  using (shop_id = current_setting('app.shop_id', true));

-- Super Admin (Chapter99) sees everything
create policy "super_admin_all" on transactions
  using (current_setting('app.role', true) = 'super_admin');

-- ── Helper: Daily revenue summary ─────────────────────────────
create or replace view daily_revenue as
select
  shop_id,
  date_trunc('day', paid_at at time zone 'Australia/Sydney') as day,
  count(*) as transaction_count,
  sum((payment->>'total')::numeric) as gross_revenue,
  sum((payment->>'gst')::numeric) as gst_collected,
  sum((payment->>'gstFreeAmt')::numeric) as gst_free_amount,
  sum((payment->>'surcharge')::numeric) as surcharge_collected,
  sum((payment->>'tip')::numeric) as tips_collected,
  sum((payment->>'netRevenue')::numeric) as net_revenue,
  count(*) filter (where payment_method = 'cash') as cash_count,
  count(*) filter (where payment_method = 'payid') as payid_count,
  count(*) filter (where payment_method = 'card') as card_count,
  count(*) filter (where payment_method = 'hicaps') as hicaps_count
from transactions
where status = 'paid'
group by shop_id, day
order by day desc;

-- ── Helper: Staff insurance alerts ────────────────────────────
create or replace view staff_alerts as
select
  s.shop_id,
  s.id as staff_id,
  s.name_en,
  'indemnity_insurance' as alert_type,
  s.indemnity_expiry as expiry_date,
  (s.indemnity_expiry - current_date) as days_remaining,
  case
    when (s.indemnity_expiry - current_date) <= 7  then 'critical'
    when (s.indemnity_expiry - current_date) <= 30 then 'warning'
    when (s.indemnity_expiry - current_date) <= 60 then 'notice'
  end as severity
from staff s
where s.indemnity_expiry is not null
  and s.active = true
  and (s.indemnity_expiry - current_date) <= 60

union all

select
  s.shop_id, s.id, s.name_en,
  'visa_expiry', s.visa_expiry,
  (s.visa_expiry - current_date),
  case
    when (s.visa_expiry - current_date) <= 30 then 'critical'
    when (s.visa_expiry - current_date) <= 60 then 'warning'
    else 'notice'
  end
from staff s
where s.visa_expiry is not null
  and s.active = true
  and (s.visa_expiry - current_date) <= 90

order by days_remaining asc;
