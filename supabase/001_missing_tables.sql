-- Trip2Talk V4 - 001 missing tables (schema)
-- Part 1/3 of 3. Supabase SQL Editor -> project trip2talk-v4
-- Order: 001_missing_tables -> 002_rls_policies -> 003_seed_data

-- -- 00-schema-phase1.sql --
-- Chapter99 V4 — Phase 1: Core Schema + PIN Auth
-- Run FIRST in Supabase SQL Editor

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── PIN Authentication ────────────────────────────────────────
-- PIN levels: 1111=staff, 4444=cashier, 9999=owner, 3501=super_admin

create table pin_sessions (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null,
  pin_level   text not null,  -- staff/cashier/owner/super_admin
  staff_id    uuid,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '8 hours',
  ip_address  text
);

-- Verify PIN function (called from API)
create or replace function verify_pin(
  p_shop_id text,
  p_pin text
) returns jsonb language plpgsql security definer as $$
declare
  v_level text;
  v_staff_id uuid;
  v_staff_name text;
begin
  -- Check shop-level PINs
  if p_pin = '9999' then
    v_level := 'owner';
  elsif p_pin = '4444' then
    v_level := 'cashier';
  elsif p_pin = '3501' then
    v_level := 'super_admin';
  else
    -- Check staff PIN
    select id, name_en into v_staff_id, v_staff_name
    from staff
    where shop_id = p_shop_id
      and pin_hash = crypt(p_pin, pin_hash)
      and active = true
    limit 1;

    if v_staff_id is not null then
      v_level := 'staff';
    else
      return jsonb_build_object('success', false, 'error', 'Invalid PIN');
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'level', v_level,
    'staffId', v_staff_id,
    'staffName', v_staff_name
  );
end;
$$;

-- -- 00-schema-phase2.sql --
-- Chapter99 V4 — Phase 2: Multi-tenant + Staff
-- Run AFTER Phase 1

-- ── Shops (Multi-tenant root) ─────────────────────────────────
create table if not exists shops (
  id              text primary key,
  name            text not null,
  abn             text,
  address         text,
  phone           text,
  email           text,
  plan            text not null default 'starter',
  theme           text default 'theme-elegant',
  active          boolean default true,
  gst_registered  boolean default true,
  currency        text default 'AUD',
  timezone        text default 'Australia/Sydney',
  -- Health Fund
  provider_name   text,
  provider_number text,
  signature_url   text,
  -- Payment
  card_surcharge  numeric(5,4) default 0.015,
  amex_surcharge  numeric(5,4) default 0.02,
  payid_bsb       text,
  payid_account   text,
  stripe_pub_key  text,
  -- Billing
  mrr             numeric(8,2) default 0,
  setup_paid      boolean default false,
  next_billing    date,
  created_at      timestamptz default now()
);

-- ── Staff ─────────────────────────────────────────────────────
create table if not exists staff (
  id                uuid primary key default uuid_generate_v4(),
  shop_id           text references shops(id) on delete cascade,
  name_en           text not null,
  name_th           text,
  role              text default 'therapist',
  pin_hash          text not null,
  commission_rate   numeric(4,2) default 0.40,
  base_hourly       numeric(6,2),
  active            boolean default true,
  -- Visa & Work Rights
  visa_type         text,
  visa_expiry       date,
  tfn_encrypted     text,
  super_fund        text,
  -- Insurance & Certs
  indemnity_expiry  date,
  liability_expiry  date,
  firstaid_expiry   date,
  cert_expiry       date,
  -- Employment
  employment_type   text default 'casual',
  start_date        date,
  probation_end     date,
  bank_bsb          text,
  bank_account      text,
  created_at        timestamptz default now()
);

-- Helper: hash PIN on insert/update
create or replace function hash_staff_pin()
returns trigger language plpgsql as $$
begin
  if new.pin_hash is not null and length(new.pin_hash) = 4 then
    new.pin_hash := crypt(new.pin_hash, gen_salt('bf'));
  end if;
  return new;
end;
$$;

create trigger staff_pin_hash
  before insert or update of pin_hash on staff
  for each row execute function hash_staff_pin();

-- RLS
alter table shops enable row level security;
alter table staff enable row level security;

create policy "shop_self" on shops using (id = current_setting('app.shop_id', true));
create policy "shop_isolation" on staff using (shop_id = current_setting('app.shop_id', true));
create policy "super_admin" on shops using (current_setting('app.role', true) = 'super_admin');

-- -- 00-schema-phase3-4.sql --
Full contents of supabase/00-schema-phase1.sql — copy everything below into Supabase SQL Editor and click Run:

-- Chapter99 V4 — Phase 1: Core Schema + PIN Auth
-- Run FIRST in Supabase SQL Editor
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";
-- ── PIN Authentication ────────────────────────────────────────
-- PIN levels: 1111=staff, 4444=cashier, 9999=owner, 3501=super_admin
create table pin_sessions (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null,
  pin_level   text not null,  -- staff/cashier/owner/super_admin
  staff_id    uuid,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '8 hours',
  ip_address  text
);
-- Verify PIN function (called from API)
create or replace function verify_pin(
  p_shop_id text,
  p_pin text
) returns jsonb language plpgsql security definer as $$
declare
  v_level text;
  v_staff_id uuid;
  v_staff_name text;
begin
  -- Check shop-level PINs
  if p_pin = '9999' then
    v_level := 'owner';
  elsif p_pin = '4444' then
    v_level := 'cashier';
  elsif p_pin = '3501' then
    v_level := 'super_admin';
  else
    -- Check staff PIN
    select id, name_en into v_staff_id, v_staff_name
    from staff
    where shop_id = p_shop_id
      and pin_hash = crypt(p_pin, pin_hash)
      and active = true
    limit 1;
    if v_staff_id is not null then
      v_level := 'staff';
    else
      return jsonb_build_object('success', false, 'error', 'Invalid PIN');
    end if;
  end if;
  return jsonb_build_object(
    'success', true,
    'level', v_level,
    'staffId', v_staff_id,
    'staffName', v_staff_name
  );
end;
$$;
Note: verify_pin references the staff table, which is created in phase 2. If you get an error like relation "staff" does not exist, run 00-schema-phase2.sql next, then run only the verify_pin block (lines 20–60) again.


Replacing tsrange with tstzrange for timestamptz columns and switching the overlap check to a proper EXCLUDE constraint (requires btree_gist on Supabase).

What was wrong: start_time / end_time are timestamptz. tsrange() only accepts timestamp (no time zone). On Supabase you need tstzrange() for timestamptz.

What we changed:

Added create extension if not exists btree_gist; (needed for overlap constraints)
Replaced the unique index with an EXCLUDE constraint using tstzrange(..., '[)')
Updated lock_slot() to use tstzrange for overlap checks
If you already created bookings (patch only)
Run this in SQL Editor before re-running the full file:

create extension if not exists btree_gist;
drop index if exists booking_no_overlap;
alter table bookings drop constraint if exists booking_no_overlap;
alter table bookings add constraint booking_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'));
create or replace function lock_slot(
  p_shop_id text,
  p_staff_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_session_id text
) returns jsonb language plpgsql as $$
declare
  v_conflict int;
begin
  select count(*) into v_conflict
  from bookings
  where staff_id = p_staff_id
    and status not in ('cancelled', 'no_show')
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');
  if v_conflict > 0 then
    return jsonb_build_object('available', false, 'reason', 'Slot taken');
  end if;
  update bookings set
    slot_locked_at = now(),
    slot_locked_by = p_session_id
  where staff_id = p_staff_id
    and start_time = p_start;
  return jsonb_build_object('available', true, 'locked_until',
    (now() + interval '5 minutes')::text);
end;
$$;
Full fixed 00-schema-phase3-4.sql (copy all)
-- Chapter99 V4 — Phase 3 & 4: Booking + Queue + Client Intake
-- Run AFTER Phase 1 & 2
-- Required for timestamptz range overlap (tstzrange + &&)
create extension if not exists btree_gist;
-- ── Services ──────────────────────────────────────────────────
create table services (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text references shops(id) on delete cascade,
  name_en     text not null,
  name_th     text,
  duration    int not null,
  price       numeric(8,2) not null,
  gst_free    boolean default false,
  item_no     text,
  category    text default 'other',
  active      boolean default true,
  sort_order  int default 0,
  created_at  timestamptz default now()
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
  -- Health Fund
  health_fund       boolean default false,
  health_fund_name  text,
  -- Medical (from intake form)
  medical_flags     jsonb default '[]',
  allergies         text,
  -- Preferences
  pressure_pref     int default 2,
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
  -- Preferences captured at booking
  pressure_pref   int,
  focus_areas     jsonb,
  medical_notes   text,
  -- Source tracking
  source          text default 'online',   -- online/walkin/phone
  booked_by       text,
  -- Slot lock (prevents double-booking)
  slot_locked_at  timestamptz,
  slot_locked_by  text,
  room_number     text,
  notes           text,
  created_at      timestamptz default now()
);
-- Prevent overlapping bookings for same staff (timestamptz → tstzrange, not tsrange)
alter table bookings add constraint booking_no_overlap
  exclude using gist (
    staff_id with =,
    tstzrange(start_time, end_time, '[)') with &&
  ) where (status not in ('cancelled', 'no_show'));
-- ── Client Intake Forms ───────────────────────────────────────
create table client_intakes (
  id                    uuid primary key default uuid_generate_v4(),
  shop_id               text references shops(id) on delete cascade,
  client_id             uuid references clients(id),
  booking_id            uuid references bookings(id),
  google_response_id    text,
  submitted_at          timestamptz,
  medical_flags         jsonb default '[]',
  allergies             text,
  focus_areas           jsonb default '[]',
  pressure_pref         int default 2,
  other_notes           text,
  signature             text,
  consent_given         boolean default false,
  drive_pdf_url         text,
  created_at            timestamptz default now()
);
-- ── Staff Briefing (auto-generated daily) ────────────────────
create table staff_briefings (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text references shops(id) on delete cascade,
  staff_id    uuid references staff(id),
  date        date not null,
  -- Briefing content (auto-built from day's bookings)
  bookings    jsonb default '[]',
  notes       jsonb default '[]',  -- manager notes
  promotions  jsonb default '[]',
  created_at  timestamptz default now(),
  unique(shop_id, staff_id, date)
);
-- ── Room Management ───────────────────────────────────────────
create table rooms (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text references shops(id) on delete cascade,
  name        text not null,         -- "Room 1", "Bed A"
  active      boolean default true,
  notes       text,
  created_at  timestamptz default now()
);
-- ── RLS ───────────────────────────────────────────────────────
alter table services       enable row level security;
alter table clients        enable row level security;
alter table bookings       enable row level security;
alter table client_intakes enable row level security;
alter table staff_briefings enable row level security;
alter table rooms          enable row level security;
create policy "shop_isolation" on services
  using (shop_id = current_setting('app.shop_id', true));
create policy "shop_isolation" on clients
  using (shop_id = current_setting('app.shop_id', true));
create policy "shop_isolation" on bookings
  using (shop_id = current_setting('app.shop_id', true));
create policy "shop_isolation" on client_intakes
  using (shop_id = current_setting('app.shop_id', true));
create policy "shop_isolation" on staff_briefings
  using (shop_id = current_setting('app.shop_id', true));
create policy "shop_isolation" on rooms
  using (shop_id = current_setting('app.shop_id', true));
-- ── Slot Lock Function ────────────────────────────────────────
create or replace function lock_slot(
  p_shop_id text,
  p_staff_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_session_id text
) returns jsonb language plpgsql as $$
declare
  v_conflict int;
begin
  -- Check for existing bookings
  select count(*) into v_conflict
  from bookings
  where staff_id = p_staff_id
    and status not in ('cancelled', 'no_show')
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');
  if v_conflict > 0 then
    return jsonb_build_object('available', false, 'reason', 'Slot taken');
  end if;
  -- Lock slot for 5 minutes
  update bookings set
    slot_locked_at = now(),
    slot_locked_by = p_session_id
  where staff_id = p_staff_id
    and start_time = p_start;
  return jsonb_build_object('available', true, 'locked_until',
    (now() + interval '5 minutes')::text);
end;
$$;
-- ── Auto-build Staff Briefing ─────────────────────────────────
create or replace function build_staff_briefing(
  p_shop_id text,
  p_staff_id uuid,
  p_date date
) returns jsonb language sql as $$
  select jsonb_build_object(
    'date', p_date,
    'staffId', p_staff_id,
    'bookings', (
      select jsonb_agg(jsonb_build_object(
        'time', to_char(b.start_time at time zone 'Australia/Sydney', 'HH24:MI'),
        'clientName', c.name,
        'service', sv.name_en,
        'duration', sv.duration,
        'pressurePref', coalesce(b.pressure_pref, c.pressure_pref, 2),
        'focusAreas', coalesce(b.focus_areas, c.focus_areas, '[]'::jsonb),
        'medicalFlags', c.medical_flags,
        'allergies', c.allergies,
        'hasHealthFund', c.health_fund,
        'notes', b.medical_notes
      ) order by b.start_time)
      from bookings b
      left join clients c on c.id = b.client_id
      left join services sv on sv.id = b.service_id
      where b.shop_id = p_shop_id
        and b.staff_id = p_staff_id
        and b.start_time::date = p_date
        and b.status != 'cancelled'
    )
  );
$$;
-- ── Indexes ───────────────────────────────────────────────────
create index booking_shop_date on bookings(shop_id, start_time);
create index booking_staff_date on bookings(staff_id, start_time);
create index client_shop on clients(shop_id);
create index client_phone on clients(shop_id, phone);
The file on disk is updated at
F:\Chapter 99 works\web_Pwa\cursor\chapter99-v4-COMPLETE_1\chapter99-v4-complete\supabase\00-schema-phase3-4.sql.

-- -- 01-schema-phase5.sql --
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

-- -- 02-schema-phase6.sql --
-- Chapter99 V4 — Phase 6 Schema Additions
-- Add to existing schema from Phase 5

-- ── Alerts table (dismissed state persists) ───────────────────
create table alerts (
  id          text primary key,
  shop_id     text references shops(id) on delete cascade,
  type        text not null,
  severity    text not null,
  title       text not null,
  message     text not null,
  staff_id    uuid references staff(id),
  days_remaining int,
  action_url  text,
  dismissed   boolean default false,
  dismissed_at timestamptz,
  created_at  timestamptz default now()
);

create index alerts_shop on alerts(shop_id, dismissed, severity);
alter table alerts enable row level security;
create policy "shop_isolation" on alerts
  using (shop_id = current_setting('app.shop_id', true));

-- ── Expenses table (for BAS / Tax report) ────────────────────
create table expenses (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text references shops(id) on delete cascade,
  date        date not null,
  description text not null,
  amount      numeric(8,2) not null,
  gst         numeric(8,2) default 0,
  category    text,       -- 'supplies','software','rent','utilities','other'
  is_capital  boolean default false,
  receipt_url text,       -- Google Drive link
  created_at  timestamptz default now()
);

alter table expenses enable row level security;
create policy "shop_isolation" on expenses
  using (shop_id = current_setting('app.shop_id', true));

-- ── Google Drive links table ──────────────────────────────────
create table drive_files (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text references shops(id) on delete cascade,
  type        text not null,  -- 'intake','receipt','health_fund','tax_report'
  file_name   text not null,
  drive_url   text not null,
  drive_id    text,
  client_id   uuid references clients(id),
  tx_id       text references transactions(id),
  created_at  timestamptz default now()
);

alter table drive_files enable row level security;
create policy "shop_isolation" on drive_files
  using (shop_id = current_setting('app.shop_id', true));

-- ── BAS Reports table ─────────────────────────────────────────
create table bas_reports (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         text references shops(id) on delete cascade,
  quarter_label   text not null,    -- 'Q1 Jul-Sep 2026'
  period_start    date not null,
  period_end      date not null,
  due_date        date not null,
  -- G Fields
  g1_total_sales  numeric(10,2),
  g3_gst_free     numeric(10,2),
  g10_capital     numeric(10,2),
  g11_non_capital numeric(10,2),
  -- Tax
  one_a_gst_sales numeric(10,2),
  one_b_gst_purch numeric(10,2),
  gst_payable     numeric(10,2),
  -- Status
  status          text default 'draft',  -- draft/submitted/paid
  submitted_at    timestamptz,
  drive_url       text,
  created_at      timestamptz default now()
);

alter table bas_reports enable row level security;
create policy "shop_isolation" on bas_reports
  using (shop_id = current_setting('app.shop_id', true));

-- ── Intake forms table (from Google Form) ────────────────────
create table client_intakes (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         text references shops(id) on delete cascade,
  client_id       uuid references clients(id),
  google_response_id text,
  submitted_at    timestamptz,
  -- Data
  medical_flags   jsonb default '[]',
  allergies       text,
  focus_areas     jsonb default '[]',
  pressure_pref   int default 2,
  other_notes     text,
  -- Consent
  signature       text,
  consent_given   boolean default false,
  -- Files
  drive_pdf_url   text,
  created_at      timestamptz default now()
);

alter table client_intakes enable row level security;
create policy "shop_isolation" on client_intakes
  using (shop_id = current_setting('app.shop_id', true));

-- ── Mark transaction as synced to Google Sheet ───────────────
alter table transactions add column if not exists synced_sheet boolean default false;
alter table transactions add column if not exists drive_receipt_url text;

-- ── BAS summary view ─────────────────────────────────────────
create or replace view quarterly_summary as
select
  t.shop_id,
  date_trunc('quarter', t.paid_at at time zone 'Australia/Sydney') as quarter,
  count(*) as transaction_count,
  sum((t.payment->>'subtotal')::numeric) as total_sales,
  sum((t.payment->>'gst')::numeric) as gst_collected,
  sum((t.payment->>'gstFreeAmt')::numeric) as gst_free_sales,
  sum((t.payment->>'surcharge')::numeric) as surcharge_total,
  sum((t.payment->>'tip')::numeric) as tips_total,
  sum((t.payment->>'total')::numeric) as gross_revenue,
  sum((t.payment->>'netRevenue')::numeric) as net_revenue,
  count(*) filter (where t.payment_method = 'hicaps') as hicaps_count,
  count(*) filter (where t.health_fund_issued = true) as health_fund_issued
from transactions t
where t.status = 'paid'
group by t.shop_id, quarter
order by quarter desc;

-- -- 03-schema-phase7.sql --
-- Chapter99 V4 — Phase 7 Schema
-- Super Admin: Proposals + MRR Views

-- ── Proposals table ───────────────────────────────────────────
create table proposals (
  id            uuid primary key default uuid_generate_v4(),
  shop_name     text not null,
  location      text,
  tier          text not null,
  status        text default 'draft',
  setup_fee     numeric(8,2),
  monthly_fee   numeric(8,2),
  bundle_name   text,
  bundle_total  numeric(8,2),
  addons        jsonb default '[]',
  notes         text,
  sent_at       timestamptz,
  expires_at    timestamptz,
  accepted_at   timestamptz,
  declined_at   timestamptz,
  created_by    text default 'super_admin',
  created_at    timestamptz default now()
);

-- Only super admin can access proposals (no RLS shop isolation)
alter table proposals enable row level security;
create policy "super_admin_only" on proposals
  using (current_setting('app.role', true) = 'super_admin');

-- ── MRR Overview (Super Admin) ────────────────────────────────
create or replace view mrr_overview as
select
  count(*) as total_shops,
  count(*) filter (where active = true) as active_shops,
  sum(case plan
    when 'starter'      then 29
    when 'professional' then 69
    when 'business'     then 110
    else 0
  end) filter (where active = true) as total_mrr,
  sum(case plan when 'starter' then 29 else 0 end)
    filter (where active = true) as starter_mrr,
  sum(case plan when 'professional' then 69 else 0 end)
    filter (where active = true) as professional_mrr,
  sum(case plan when 'business' then 110 else 0 end)
    filter (where active = true) as business_mrr,
  count(*) filter (where plan = 'starter' and active = true) as starter_count,
  count(*) filter (where plan = 'professional' and active = true) as professional_count,
  count(*) filter (where plan = 'business' and active = true) as business_count
from shops;

-- ── Shop health view (Super Admin) ───────────────────────────
create or replace view shop_health as
select
  s.id,
  s.name,
  s.plan,
  s.active,
  s.created_at,
  s.phone,
  s.email,
  -- Bookings this month
  count(distinct b.id) filter (
    where b.created_at >= date_trunc('month', now())
  ) as bookings_this_month,
  -- Revenue this month
  coalesce(sum((t.payment->>'total')::numeric) filter (
    where t.paid_at >= date_trunc('month', now())
    and t.status = 'paid'
  ), 0) as revenue_this_month,
  -- Active staff
  count(distinct st.id) filter (where st.active = true) as active_staff,
  -- Critical alerts
  count(distinct a.id) filter (
    where a.dismissed = false and a.severity = 'critical'
  ) as critical_alerts,
  -- Last activity
  max(t.paid_at) as last_transaction
from shops s
left join bookings b on b.shop_id = s.id
left join transactions t on t.shop_id = s.id
left join staff st on st.shop_id = s.id
left join alerts a on a.shop_id = s.id
group by s.id, s.name, s.plan, s.active, s.created_at, s.phone, s.email
order by s.created_at desc;

-- ── All-shops transaction summary (Super Admin) ───────────────
create or replace view all_shops_revenue as
select
  t.shop_id,
  sh.name as shop_name,
  sh.plan,
  date_trunc('month', t.paid_at at time zone 'Australia/Sydney') as month,
  count(*) as tx_count,
  sum((t.payment->>'total')::numeric) as gross_revenue,
  sum((t.payment->>'gst')::numeric) as gst_collected,
  sum((t.payment->>'netRevenue')::numeric) as net_revenue
from transactions t
join shops sh on sh.id = t.shop_id
where t.status = 'paid'
group by t.shop_id, sh.name, sh.plan, month
order by month desc, gross_revenue desc;

-- ── Function: Generate shop config JSON ───────────────────────
create or replace function get_shop_config(p_shop_id text)
returns jsonb language sql as $$
  select jsonb_build_object(
    'shopId', s.id,
    'name', s.name,
    'plan', s.plan,
    'abn', s.abn,
    'phone', s.phone,
    'email', s.email,
    'address', s.address,
    'providerName', s.provider_name,
    'providerNumber', s.provider_number,
    'settings', jsonb_build_object(
      'gst', 0.10,
      'cardSurcharge', s.card_surcharge,
      'amexSurcharge', s.amex_surcharge,
      'currency', s.currency,
      'timezone', s.timezone
    ),
    'services', (
      select jsonb_agg(jsonb_build_object(
        'id', sv.id,
        'nameEn', sv.name_en,
        'duration', sv.duration,
        'price', sv.price,
        'gstFree', sv.gst_free,
        'itemNo', sv.item_no
      ))
      from services sv
      where sv.shop_id = s.id and sv.active = true
    )
  )
  from shops s
  where s.id = p_shop_id;
$$;

-- -- 05-receipt-system.sql --
-- Chapter99 V4 — Receipt System
-- Run in Supabase SQL Editor after prior phases

-- ── Shop branding & receipt settings ─────────────────────────
alter table shops add column if not exists logo_url text;
alter table shops add column if not exists theme_color text default '#0F6E56';

-- ── Receipt history ───────────────────────────────────────────
create table if not exists receipts (
  id              uuid primary key default uuid_generate_v4(),
  shop_id         text not null references shops(id) on delete cascade,
  transaction_id  text not null,
  receipt_number  text not null,
  client_name     text,
  client_email    text,
  payment_method  text,
  total           numeric(10,2) not null,
  pdf_url         text,
  email_sent      boolean default false,
  health_fund     boolean default false,
  issued_at       timestamptz default now(),
  created_at      timestamptz default now()
);

create index if not exists receipts_shop_issued on receipts(shop_id, issued_at desc);
create index if not exists receipts_transaction on receipts(shop_id, transaction_id);

alter table receipts enable row level security;

drop policy if exists "anon_select_receipts" on receipts;
create policy "anon_select_receipts" on receipts
  for select to anon, authenticated using (true);

drop policy if exists "anon_insert_receipts" on receipts;
create policy "anon_insert_receipts" on receipts
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_receipts" on receipts;
create policy "anon_update_receipts" on receipts
  for update to anon, authenticated using (true) with check (true);

-- ── Storage: shop logos & signatures ──────────────────────────
insert into storage.buckets (id, name, public)
values ('shop-assets', 'shop-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "shop_assets_public_read" on storage.objects;
create policy "shop_assets_public_read" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'shop-assets');

drop policy if exists "shop_assets_anon_upload" on storage.objects;
create policy "shop_assets_anon_upload" on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'shop-assets');

drop policy if exists "shop_assets_anon_update" on storage.objects;
create policy "shop_assets_anon_update" on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'shop-assets');

-- -- 06-receipt-transaction-data.sql --
-- Optional: store full transaction snapshot on each receipt
alter table receipts add column if not exists transaction_data jsonb;

-- -- 07-google-sheets.sql --
-- Chapter99 V4 — Google Sheets sync settings per shop
alter table shops add column if not exists google_sheet_url text;
alter table shops add column if not exists google_sheet_sync_enabled boolean default false;

-- -- 09-google-review-url.sql --
-- Chapter99 V4 — Google Review URL for POS QR prompt (not on printed receipt)
alter table shops add column if not exists google_review_url text;

-- -- 10-gift-vouchers.sql --
-- Chapter99 V4 — Gift Vouchers (POS sell + redeem)
-- Run in Supabase SQL Editor after prior phases

-- ── Table ─────────────────────────────────────────────────────
create table if not exists gift_vouchers (
  id                uuid primary key default uuid_generate_v4(),
  code              text not null unique,
  original_amount   numeric(10,2) not null check (original_amount > 0),
  remaining_balance numeric(10,2) not null check (remaining_balance >= 0),
  expiry_date       date not null,
  status            text not null default 'active'
    check (status in ('active', 'redeemed', 'expired')),
  purchased_via     text not null default 'pos'
    check (purchased_via in ('web', 'pos')),
  buyer_name        text,
  buyer_email       text,
  shop_id           text not null references shops(id) on delete cascade,
  created_at        timestamptz default now()
);

create index if not exists gift_vouchers_shop_created
  on gift_vouchers(shop_id, created_at desc);

create index if not exists gift_vouchers_code
  on gift_vouchers(upper(code));

-- ── Auto-generate code: CH99-XXXX (4 chars, no ambiguous 0/O/I/1) ──
create or replace function generate_gift_voucher_code()
returns text
language plpgsql
as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  suffix text := '';
  i int;
  new_code text;
begin
  loop
    suffix := '';
    for i in 1..4 loop
      suffix := suffix || substr(chars, (floor(random() * length(chars))::int + 1), 1);
    end loop;
    new_code := 'CH99-' || suffix;
    exit when not exists (select 1 from gift_vouchers where code = new_code);
  end loop;
  return new_code;
end;
$$;

create or replace function gift_vouchers_set_code()
returns trigger
language plpgsql
as $$
begin
  if new.code is null or trim(new.code) = '' then
    new.code := generate_gift_voucher_code();
  end if;
  new.code := upper(trim(new.code));
  return new;
end;
$$;

drop trigger if exists trg_gift_vouchers_set_code on gift_vouchers;
create trigger trg_gift_vouchers_set_code
  before insert on gift_vouchers
  for each row execute function gift_vouchers_set_code();

-- ── Validate (read-only, for POS lookup) ──────────────────────
create or replace function validate_gift_voucher(p_code text, p_shop_id text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v gift_vouchers%rowtype;
begin
  select * into v
  from gift_vouchers
  where upper(trim(code)) = upper(trim(p_code))
    and shop_id = p_shop_id;

  if not found then
    return jsonb_build_object('valid', false, 'error', 'Invalid voucher code');
  end if;

  if v.expiry_date < current_date then
    update gift_vouchers set status = 'expired' where id = v.id and status = 'active';
    return jsonb_build_object('valid', false, 'error', 'Voucher has expired');
  end if;

  if v.status = 'redeemed' then
    return jsonb_build_object('valid', false, 'error', 'Voucher already fully redeemed');
  end if;

  if v.status = 'expired' then
    return jsonb_build_object('valid', false, 'error', 'Voucher has expired');
  end if;

  if v.remaining_balance <= 0 then
    return jsonb_build_object('valid', false, 'error', 'Voucher has no balance');
  end if;

  return jsonb_build_object(
    'valid', true,
    'code', v.code,
    'original_amount', v.original_amount,
    'remaining_balance', v.remaining_balance,
    'expiry_date', v.expiry_date,
    'status', v.status,
    'buyer_name', v.buyer_name
  );
end;
$$;

-- ── Redeem (atomic deduct on payment) ─────────────────────────
create or replace function redeem_gift_voucher(
  p_code text,
  p_shop_id text,
  p_amount numeric
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v gift_vouchers%rowtype;
  v_deduct numeric;
  v_new_balance numeric;
  v_new_status text;
begin
  if p_amount is null or p_amount <= 0 then
    return jsonb_build_object('success', false, 'error', 'Invalid redemption amount');
  end if;

  select * into v
  from gift_vouchers
  where upper(trim(code)) = upper(trim(p_code))
    and shop_id = p_shop_id
  for update;

  if not found then
    return jsonb_build_object('success', false, 'error', 'Invalid voucher code');
  end if;

  if v.expiry_date < current_date then
    update gift_vouchers set status = 'expired' where id = v.id;
    return jsonb_build_object('success', false, 'error', 'Voucher has expired');
  end if;

  if v.status in ('redeemed', 'expired') then
    return jsonb_build_object('success', false, 'error', 'Voucher is not active');
  end if;

  if v.remaining_balance <= 0 then
    return jsonb_build_object('success', false, 'error', 'Voucher has no balance');
  end if;

  v_deduct := least(p_amount, v.remaining_balance);
  v_new_balance := round((v.remaining_balance - v_deduct)::numeric, 2);
  v_new_status := case when v_new_balance <= 0 then 'redeemed' else 'active' end;

  update gift_vouchers
  set remaining_balance = v_new_balance,
      status = v_new_status
  where id = v.id;

  return jsonb_build_object(
    'success', true,
    'code', v.code,
    'deducted', v_deduct,
    'remaining_balance', v_new_balance,
    'status', v_new_status
  );
end;
$$;

-- ── RLS (anon — same pattern as receipts / transactions) ─────
alter table gift_vouchers enable row level security;

drop policy if exists "anon_select_gift_vouchers" on gift_vouchers;
create policy "anon_select_gift_vouchers" on gift_vouchers
  for select to anon, authenticated
  using (shop_id is not null);

drop policy if exists "anon_insert_gift_vouchers" on gift_vouchers;
create policy "anon_insert_gift_vouchers" on gift_vouchers
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_gift_vouchers" on gift_vouchers;
create policy "anon_update_gift_vouchers" on gift_vouchers
  for update to anon, authenticated
  using (true)
  with check (true);

grant execute on function validate_gift_voucher(text, text) to anon, authenticated;
grant execute on function redeem_gift_voucher(text, text, numeric) to anon, authenticated;

-- -- 13-features.sql --
-- Chapter99 — Split payments, transaction extras, voucher recipients, alerts RLS

alter table transactions
  add column if not exists payment_splits jsonb,
  add column if not exists therapist_name text,
  add column if not exists voucher_code text,
  add column if not exists voucher_amount numeric(10,2);

alter table gift_vouchers
  add column if not exists recipient_name text,
  add column if not exists recipient_email text,
  add column if not exists stripe_session_id text unique;

-- Allow anon POS to read/write transactions with shop_id (if not already)
drop policy if exists "anon_upsert_transactions" on transactions;
create policy "anon_upsert_transactions" on transactions
  for all to anon, authenticated
  using (shop_id is not null)
  with check (shop_id is not null);

-- Alerts: allow anon read for dashboard; service role bypasses RLS for cron
drop policy if exists "shop_isolation" on alerts;
drop policy if exists "anon_select_alerts" on alerts;
drop policy if exists "anon_insert_alerts" on alerts;
drop policy if exists "anon_update_alerts" on alerts;

create policy "anon_select_alerts" on alerts
  for select to anon, authenticated
  using (shop_id is not null);

create policy "anon_insert_alerts" on alerts
  for insert to anon, authenticated
  with check (shop_id is not null);

create policy "anon_update_alerts" on alerts
  for update to anon, authenticated
  using (shop_id is not null)
  with check (shop_id is not null);

-- -- 14-booking-capacity.sql --
-- Chapter99 — Shop-wide booking capacity: MIN(rooms, therapists) per time slot

-- Anon can read rooms for capacity counts
drop policy if exists "anon_select_rooms" on rooms;
create policy "anon_select_rooms" on rooms
  for select to anon, authenticated
  using (shop_id is not null);

-- Replace lock_slot: shop capacity + optional therapist conflict
create or replace function lock_slot(
  p_shop_id text,
  p_staff_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_session_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_count int;
  v_therapist_count int;
  v_capacity int;
  v_overlap int;
  v_staff_conflict int;
begin
  select count(*)::int into v_room_count
  from rooms
  where shop_id = p_shop_id and active = true;

  select count(*)::int into v_therapist_count
  from staff
  where shop_id = p_shop_id
    and active = true
    and role in ('therapist', 'owner', 'manager');

  if coalesce(v_room_count, 0) < 1 then v_room_count := 3; end if;
  if coalesce(v_therapist_count, 0) < 1 then v_therapist_count := 1; end if;
  v_capacity := least(v_room_count, v_therapist_count);

  select count(*)::int into v_overlap
  from bookings
  where shop_id = p_shop_id
    and status not in ('cancelled', 'no_show')
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

  if v_overlap >= v_capacity then
    return jsonb_build_object(
      'available', false,
      'reason', 'This time slot is full',
      'capacity', v_capacity,
      'booked', v_overlap
    );
  end if;

  if p_staff_id is not null then
    select count(*)::int into v_staff_conflict
    from bookings
    where shop_id = p_shop_id
      and staff_id = p_staff_id
      and status not in ('cancelled', 'no_show')
      and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

    if v_staff_conflict > 0 then
      return jsonb_build_object(
        'available', false,
        'reason', 'This therapist is not available',
        'capacity', v_capacity,
        'booked', v_overlap
      );
    end if;
  end if;

  return jsonb_build_object(
    'available', true,
    'capacity', v_capacity,
    'booked', v_overlap,
    'locked_until', (now() + interval '5 minutes')::text
  );
end;
$$;

-- Validate before insert (Booking Wizard / server-side pattern)
create or replace function check_booking_slot(
  p_shop_id text,
  p_start timestamptz,
  p_end timestamptz,
  p_staff_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_count int;
  v_therapist_count int;
  v_capacity int;
  v_overlap int;
  v_staff_conflict int;
begin
  select count(*)::int into v_room_count
  from rooms where shop_id = p_shop_id and active = true;

  select count(*)::int into v_therapist_count
  from staff
  where shop_id = p_shop_id and active = true
    and role in ('therapist', 'owner', 'manager');

  if coalesce(v_room_count, 0) < 1 then v_room_count := 3; end if;
  if coalesce(v_therapist_count, 0) < 1 then v_therapist_count := 1; end if;
  v_capacity := least(v_room_count, v_therapist_count);

  select count(*)::int into v_overlap
  from bookings
  where shop_id = p_shop_id
    and status not in ('cancelled', 'no_show')
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

  if v_overlap >= v_capacity then
    return jsonb_build_object('available', false, 'reason', 'This time slot is full');
  end if;

  if p_staff_id is not null then
    select count(*)::int into v_staff_conflict
    from bookings
    where shop_id = p_shop_id and staff_id = p_staff_id
      and status not in ('cancelled', 'no_show')
      and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

    if v_staff_conflict > 0 then
      return jsonb_build_object('available', false, 'reason', 'This therapist is not available');
    end if;
  end if;

  return jsonb_build_object('available', true, 'capacity', v_capacity, 'booked', v_overlap);
end;
$$;

grant execute on function lock_slot(text, uuid, timestamptz, timestamptz, text) to anon, authenticated;
grant execute on function check_booking_slot(text, timestamptz, timestamptz, uuid) to anon, authenticated;

-- -- 15-booking-therapist-name.sql --
-- Chapter99 — Denormalized therapist name on bookings (staff dashboard wizard)

alter table bookings add column if not exists therapist_name text;

-- -- 16-booking-therapist-slots.sql --
-- Chapter99 — Per-therapist slot validation (replaces shop-wide capacity blocking)
-- Run in Supabase SQL Editor after 14-booking-capacity.sql

create or replace function check_booking_slot(
  p_shop_id text,
  p_start timestamptz,
  p_end timestamptz,
  p_staff_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_therapist_count int;
  v_busy_therapists int;
  v_staff_conflict int;
begin
  -- Specific therapist: only that staff member must be free
  if p_staff_id is not null then
    select count(*)::int into v_staff_conflict
    from bookings
    where shop_id = p_shop_id
      and staff_id = p_staff_id
      and status not in ('cancelled', 'no_show')
      and start_time < p_end
      and end_time > p_start;

    if v_staff_conflict > 0 then
      return jsonb_build_object(
        'available', false,
        'reason', 'This therapist is not available at this time'
      );
    end if;

    return jsonb_build_object('available', true);
  end if;

  -- No preference: allow if at least one active therapist is free
  select count(*)::int into v_therapist_count
  from staff
  where shop_id = p_shop_id
    and active = true
    and role = 'therapist';

  if coalesce(v_therapist_count, 0) < 1 then
    return jsonb_build_object('available', true, 'note', 'no therapists configured');
  end if;

  select count(*)::int into v_busy_therapists
  from staff s
  where s.shop_id = p_shop_id
    and s.active = true
    and s.role = 'therapist'
    and exists (
      select 1
      from bookings b
      where b.shop_id = p_shop_id
        and b.staff_id = s.id
        and b.status not in ('cancelled', 'no_show')
        and b.start_time < p_end
        and b.end_time > p_start
    );

  if v_busy_therapists >= v_therapist_count then
    return jsonb_build_object(
      'available', false,
      'reason', 'All therapists are booked at this time',
      'therapists', v_therapist_count,
      'busy', v_busy_therapists
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'therapists', v_therapist_count,
    'busy', v_busy_therapists
  );
end;
$$;

create or replace function lock_slot(
  p_shop_id text,
  p_staff_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_session_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_check jsonb;
begin
  v_check := check_booking_slot(p_shop_id, p_start, p_end, p_staff_id);

  if not (v_check->>'available')::boolean then
    return v_check;
  end if;

  return v_check || jsonb_build_object(
    'locked_until', (now() + interval '5 minutes')::text
  );
end;
$$;

grant execute on function check_booking_slot(text, timestamptz, timestamptz, uuid) to anon, authenticated;
grant execute on function lock_slot(text, uuid, timestamptz, timestamptz, text) to anon, authenticated;

-- -- 16-rooms.sql --
-- Chapter99 — Room management (Settings + Queue + Booking Wizard)
-- Safe if rooms already exists from phase 3 schema

create table if not exists rooms (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null references shops(id) on delete cascade,
  name        text not null,
  active      boolean default true,
  created_at  timestamptz default now()
);

create index if not exists rooms_shop_active on rooms(shop_id, active);

alter table rooms enable row level security;

drop policy if exists "shop_isolation" on rooms;
drop policy if exists "anon_select_rooms" on rooms;
drop policy if exists "anon_insert_rooms" on rooms;
drop policy if exists "anon_update_rooms" on rooms;
drop policy if exists "anon_delete_rooms" on rooms;

create policy "anon_select_rooms" on rooms
  for select to anon, authenticated
  using (shop_id is not null);

create policy "anon_insert_rooms" on rooms
  for insert to anon, authenticated
  with check (shop_id is not null);

create policy "anon_update_rooms" on rooms
  for update to anon, authenticated
  using (true)
  with check (true);

create policy "anon_delete_rooms" on rooms
  for delete to anon, authenticated
  using (true);

-- -- 17-booking-room.sql --
-- Chapter99 — Assign rooms to bookings via room_id FK

alter table bookings
  add column if not exists room_id uuid references rooms(id) on delete set null;

create index if not exists bookings_room_id on bookings(room_id);

-- -- 18-notifications.sql --
-- Chapter99 — In-app booking notifications (Alerts panel)

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null references shops(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete set null,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_shop_unread
  on notifications(shop_id, is_read, created_at desc);

create index if not exists notifications_booking
  on notifications(booking_id);

alter table notifications enable row level security;

drop policy if exists "anon_select_notifications" on notifications;
drop policy if exists "anon_insert_notifications" on notifications;
drop policy if exists "anon_update_notifications" on notifications;

create policy "anon_select_notifications" on notifications
  for select to anon, authenticated
  using (shop_id is not null);

create policy "anon_insert_notifications" on notifications
  for insert to anon, authenticated
  with check (shop_id is not null);

create policy "anon_update_notifications" on notifications
  for update to anon, authenticated
  using (true)
  with check (true);

-- Notify Alerts panel on every new booking (walk-in + online)
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text := 'Walk-in guest';
  v_service_name text := 'Service';
  v_therapist text;
  v_room text;
  v_payload jsonb;
begin
  if NEW.shop_id is null then
    return NEW;
  end if;

  if NEW.client_id is not null then
    select coalesce(nullif(trim(c.name), ''), 'Walk-in guest')
    into v_client_name
    from clients c
    where c.id = NEW.client_id;
  end if;

  if NEW.service_id is not null then
    select coalesce(nullif(trim(s.name_en), ''), 'Service')
    into v_service_name
    from services s
    where s.id = NEW.service_id;
  end if;

  v_therapist := nullif(trim(coalesce(NEW.therapist_name, '')), '');
  if v_therapist is null and NEW.staff_id is not null then
    select nullif(trim(s.name_en), '')
    into v_therapist
    from staff s
    where s.id = NEW.staff_id;
  end if;

  if NEW.room_id is not null then
    select nullif(trim(r.name), '')
    into v_room
    from rooms r
    where r.id = NEW.room_id;
  end if;

  v_payload := jsonb_build_object(
    'type', 'booking',
    'clientName', v_client_name,
    'serviceName', v_service_name,
    'appointmentAt', NEW.start_time,
    'therapist', v_therapist,
    'room', v_room,
    'source', coalesce(NEW.source, 'online'),
    'bookedAt', coalesce(NEW.created_at, now())
  );

  insert into notifications (shop_id, booking_id, message, is_read)
  values (NEW.shop_id, NEW.id, v_payload::text, false);

  return NEW;
end;
$$;

drop trigger if exists trg_booking_notification on bookings;
create trigger trg_booking_notification
  after insert on bookings
  for each row
  execute function notify_new_booking();

-- Realtime badge updates in dashboard
alter table notifications replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    null;
  elsif exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications;
  end if;
exception
  when undefined_object then null;
  when duplicate_object then null;
end;
$$;

-- -- 20-shop-notification-email.sql --
-- Chapter99 V4 — Owner notification email for new booking alerts
alter table shops add column if not exists notification_email text;

comment on column shops.notification_email is
  'Email address that receives new booking confirmation alerts for the shop';

-- -- 21-shop-slug-business-type.sql --
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

-- -- 22-shop-page-visibility.sql --
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

-- -- 22-shop-website-settings.sql --
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

-- -- 23-shop-website-content.sql --
-- Public website copy (hero + about). Page visibility: 22-shop-page-visibility.sql

alter table shops
  add column if not exists hero_title text,
  add column if not exists hero_subtitle text,
  add column if not exists about_text text,
  add column if not exists about_phone text,
  add column if not exists about_address text,
  add column if not exists google_maps_url text;

comment on column shops.hero_title is 'Public home hero headline (falls back to shop name)';
comment on column shops.hero_subtitle is 'Public home hero subtext';
comment on column shops.about_text is 'Public about page body copy';
comment on column shops.about_phone is 'Public about page phone (falls back to shop phone)';
comment on column shops.about_address is 'Public about page address (falls back to shop address)';
comment on column shops.google_maps_url is 'Google Maps link for about page';

-- -- 24-shop-website-images.sql --
-- Public website images (hero, logo uses shops.logo_url, per-service photos)

alter table shops
  add column if not exists hero_image_url text;

alter table services
  add column if not exists image_url text;

comment on column shops.hero_image_url is 'Home page hero banner image URL (shop-assets bucket)';
comment on column services.image_url is 'Public services/menu listing photo';

-- -- 25-shop-plans.sql --
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

-- -- 26-shops-public-and-plans.sql --
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

-- -- 27-plan-tier-rename.sql --
-- Rename legacy plan tiers → starter | growth | pro (idempotent)

update shops set plan = 'growth' where plan = 'professional';
update shops set plan = 'pro' where plan in ('business', 'business_plus');

alter table shops drop constraint if exists shops_plan_check;

alter table shops
  add constraint shops_plan_check
  check (plan in ('starter', 'growth', 'pro'));

-- Super Admin MRR view (monthly subscription amounts)
create or replace view mrr_overview as
select
  count(*) as total_shops,
  count(*) filter (where active = true) as active_shops,
  sum(case plan
    when 'starter' then 69
    when 'growth'  then 129
    when 'pro'     then 199
    else 0
  end) filter (where active = true) as total_mrr,
  sum(case plan when 'starter' then 69 else 0 end)
    filter (where active = true) as starter_mrr,
  sum(case plan when 'growth' then 129 else 0 end)
    filter (where active = true) as growth_mrr,
  sum(case plan when 'pro' then 199 else 0 end)
    filter (where active = true) as pro_mrr,
  count(*) filter (where plan = 'starter' and active = true) as starter_count,
  count(*) filter (where plan = 'growth' and active = true) as growth_count,
  count(*) filter (where plan = 'pro' and active = true) as pro_count
from shops;

-- -- 28-shop-assets-hero-paths.sql --
-- Hero / logo / service images — bucket paths: shops/{shop_id}/hero.{ext}
-- Run after 11-storage-logo-policy.sql and 24-shop-website-images.sql

alter table shops
  add column if not exists hero_image_url text;

alter table services
  add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shop-assets',
  'shop-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "shop_assets_select" on storage.objects;
drop policy if exists "shop_assets_insert" on storage.objects;
drop policy if exists "shop_assets_update" on storage.objects;
drop policy if exists "shop_assets_delete" on storage.objects;

create policy "shop_assets_select"
on storage.objects for select to public
using (bucket_id = 'shop-assets');

-- shops/{shop_id}/… or legacy {shop_id}/… paths
create policy "shop_assets_insert"
on storage.objects for insert to public
with check (
  bucket_id = 'shop-assets'
  and (
    (storage.foldername(name))[1] = 'shops'
    or (storage.foldername(name))[1] is not null
  )
);

create policy "shop_assets_update"
on storage.objects for update to public
using (bucket_id = 'shop-assets')
with check (
  bucket_id = 'shop-assets'
  and (
    (storage.foldername(name))[1] = 'shops'
    or (storage.foldername(name))[1] is not null
  )
);

create policy "shop_assets_delete"
on storage.objects for delete to public
using (bucket_id = 'shop-assets');

-- -- 29-review-request.sql --
-- Google Review Request after POS checkout

alter table shops
  add column if not exists review_request_enabled boolean default false;

alter table shops
  add column if not exists google_review_url text;

alter table shops
  add column if not exists review_request_channel text default 'email';

-- Normalize channel values (safe if column already exists without check)
update shops
set review_request_channel = 'email'
where review_request_channel is null
   or review_request_channel not in ('email', 'sms', 'both');

alter table shops
  drop constraint if exists shops_review_request_channel_check;

alter table shops
  add constraint shops_review_request_channel_check
  check (review_request_channel in ('email', 'sms', 'both'));

alter table clients
  add column if not exists last_review_request_sent timestamptz;

comment on column shops.review_request_enabled is 'Send Google review request after POS payment';
comment on column shops.review_request_channel is 'email | sms | both';
comment on column clients.last_review_request_sent is 'Last automated review request (30-day rate limit)';

-- -- 30-shop-custom-domain.sql --
-- Custom domain per shop (e.g. mira-thai-massage.com.au)
-- Map host → slug in Vercel SHOP_DOMAIN_MAP / VITE_SHOP_DOMAIN_MAP

alter table shops
  add column if not exists domain text;

create unique index if not exists shops_domain_unique
  on shops (lower(domain))
  where domain is not null and domain <> '';

comment on column shops.domain is 'Custom hostname without protocol, e.g. mira-thai-massage.com.au';

-- -- 31-shop-legal-urls.sql --
-- Privacy policy and terms of service links for public footer

alter table shops
  add column if not exists privacy_policy_url text,
  add column if not exists terms_url text;

comment on column shops.privacy_policy_url is 'External privacy policy URL for public footer';
comment on column shops.terms_url is 'External terms of service URL for public footer';

-- -- 32-booking-reminders.sql --
-- Booking reminders, cancellation metadata, terms agreement (public online booking)

alter table bookings
  add column if not exists reminder_sent_at timestamptz;

alter table bookings
  add column if not exists cancellation_token text;

alter table bookings
  add column if not exists cancelled_at timestamptz;

alter table bookings
  add column if not exists cancellation_reason text;

alter table bookings
  add column if not exists terms_agreed boolean default false;

alter table bookings
  add column if not exists terms_agreed_at timestamptz;

comment on column bookings.reminder_sent_at is 'When 24h reminder SMS was sent (null = not sent)';
comment on column bookings.cancellation_token is 'Optional token for public cancel links';
comment on column bookings.cancelled_at is 'When the booking was cancelled';
comment on column bookings.cancellation_reason is 'Client-provided cancellation reason';
comment on column bookings.terms_agreed is 'Client accepted Terms and Privacy at booking time';
comment on column bookings.terms_agreed_at is 'When terms were accepted';

-- -- 33-booking-deposit.sql --
-- Online booking deposits (Stripe prepayment)

alter table bookings
  add column if not exists deposit_amount numeric(10,2);

alter table bookings
  add column if not exists deposit_paid boolean default false;

alter table bookings
  add column if not exists deposit_paid_at timestamptz;

alter table bookings
  add column if not exists deposit_stripe_session_id text;

alter table bookings
  add column if not exists deposit_stripe_payment_intent text;

alter table bookings
  add column if not exists deposit_refunded boolean default false;

alter table bookings
  add column if not exists deposit_refunded_at timestamptz;

alter table shops
  add column if not exists deposit_enabled boolean default false;

alter table shops
  add column if not exists deposit_type text default 'percent';

alter table shops
  add column if not exists deposit_percent integer default 20;

alter table shops
  add column if not exists deposit_fixed_amount numeric(10,2) default 20.00;

alter table shops
  add column if not exists deposit_refund_hours integer default 24;

-- Add check constraint only if missing
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shops_deposit_type_check'
  ) then
    alter table shops
      add constraint shops_deposit_type_check
      check (deposit_type in ('percent', 'fixed'));
  end if;
end $$;

comment on column shops.deposit_enabled is 'Require Stripe deposit for public online bookings';
comment on column bookings.deposit_amount is 'Deposit charged at booking (AUD)';

-- Skip Alerts notification until deposit is paid (pending_deposit = unpaid hold)
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text := 'Walk-in guest';
  v_service_name text := 'Service';
  v_therapist text;
  v_room text;
  v_payload jsonb;
begin
  if NEW.shop_id is null then
    return NEW;
  end if;

  if NEW.status = 'pending_deposit' then
    return NEW;
  end if;

  if NEW.client_id is not null then
    select coalesce(nullif(trim(c.name), ''), 'Walk-in guest')
    into v_client_name
    from clients c
    where c.id = NEW.client_id;
  end if;

  if NEW.service_id is not null then
    select coalesce(nullif(trim(s.name_en), ''), 'Service')
    into v_service_name
    from services s
    where s.id = NEW.service_id;
  end if;

  v_therapist := nullif(trim(coalesce(NEW.therapist_name, '')), '');
  if v_therapist is null and NEW.staff_id is not null then
    select nullif(trim(s.name_en), '')
    into v_therapist
    from staff s
    where s.id = NEW.staff_id;
  end if;

  if NEW.room_id is not null then
    select nullif(trim(r.name), '')
    into v_room
    from rooms r
    where r.id = NEW.room_id;
  end if;

  v_payload := jsonb_build_object(
    'type', 'booking',
    'clientName', v_client_name,
    'serviceName', v_service_name,
    'appointmentAt', NEW.start_time,
    'therapist', v_therapist,
    'room', v_room,
    'source', coalesce(NEW.source, 'online'),
    'bookedAt', coalesce(NEW.created_at, now())
  );

  insert into notifications (shop_id, booking_id, message, is_read)
  values (NEW.shop_id, NEW.id, v_payload::text, false);

  return NEW;
end;
$$;

-- -- 35-service-addons.sql --
-- Service add-ons for POS (Owner Settings + bill line items)
-- Safe to re-run: drops old policy names before creating "Shop access"

CREATE TABLE IF NOT EXISTS service_addons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_id TEXT NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_addons_shop_id_idx ON service_addons(shop_id);

ALTER TABLE service_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shop_addons_access" ON service_addons;
DROP POLICY IF EXISTS "Shop access" ON service_addons;

CREATE POLICY "Shop access" ON service_addons
  FOR ALL
  USING (true)
  WITH CHECK (true);


-- -- 34-verify-pin-crypt-only.sql (function only) --
-- Chapter99 V4 — verify_pin: bcrypt-only via staff.pin_hash (no hardcoded PINs)
-- Run in Supabase SQL Editor after prior migrations.
--
-- Replaces shop-level plaintext checks (9999/4444/3501) with staff table lookup.
-- Default role PIN rows are seeded below for shops missing owner/cashier/super_admin
-- (and a demo therapist when a shop has no therapists). Plain 4-digit pin_hash
-- values are hashed by the staff_pin_hash trigger (supabase/12-staff-manager-rls.sql).

create extension if not exists pgcrypto;

create or replace function verify_pin(
  p_shop_id text,
  p_pin text
) returns jsonb language plpgsql security definer as $$
declare
  v_staff_id uuid;
  v_staff_name text;
  v_staff_role text;
  v_level text;
begin
  select id, name_en, role
  into v_staff_id, v_staff_name, v_staff_role
  from staff
  where shop_id = p_shop_id
    and active = true
    and pin_hash = crypt(p_pin, pin_hash)
  limit 1;

  if v_staff_id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid PIN');
  end if;

  v_level := case v_staff_role
    when 'therapist' then 'staff'
    when 'cashier' then 'cashier'
    when 'owner' then 'owner'
    when 'manager' then 'cashier'
    when 'super_admin' then 'super_admin'
    else 'staff'
  end;

  return jsonb_build_object(
    'success', true,
    'level', v_level,
    'staffId', v_staff_id,
    'staffName', v_staff_name
  );
end;
$$;

-- ── Seed default role PIN rows (only when missing) ───────────────────────────
-- Owner PIN 9999, Cashier PIN 4444, Super Admin PIN 3501, demo therapist PIN 1111

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Owner', 'owner', '9999', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'owner' and st.active = true
);

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Cashier', 'cashier', '4444', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'cashier' and st.active = true
);

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Super Admin', 'super_admin', '3501', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'super_admin' and st.active = true
);

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Demo Staff', 'therapist', '1111', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'therapist' and st.active = true
);
