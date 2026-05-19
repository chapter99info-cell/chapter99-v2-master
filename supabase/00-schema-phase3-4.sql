-- Chapter99 V4 — Phase 3 & 4: Booking + Queue + Client Intake
-- Run AFTER Phase 1 & 2

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

-- Prevent overlapping bookings for same staff
create unique index booking_no_overlap
  on bookings (staff_id, tsrange(start_time, end_time))
  where status not in ('cancelled', 'no_show');

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
    and tsrange(start_time, end_time) && tsrange(p_start, p_end);

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
