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