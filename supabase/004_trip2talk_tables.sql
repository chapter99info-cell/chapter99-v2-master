-- Trip2Talk V4 client + tour tables (run after 001-003 on fresh DB, or standalone on empty project)

create extension if not exists "uuid-ossp";

create table if not exists tours (
  id uuid primary key default uuid_generate_v4(),
  trip_code text not null unique,
  destination text not null check (destination in ('New Zealand', 'Sydney')),
  start_date date not null,
  end_date date not null,
  price_aud numeric(10,2) not null default 0,
  max_pax int not null default 20,
  current_pax int not null default 0,
  status text not null default 'PLANNING'
    check (status in ('PLANNING','CONFIRMED','ACTIVE','COMPLETED','CANCELLED')),
  base_commission_rate numeric(5,4) default 0.1,
  bonus_threshold_pax int default 15,
  bonus_amount_aud numeric(10,2) default 500,
  created_at timestamptz default now()
);

create table if not exists staff_profiles (
  id uuid primary key default uuid_generate_v4(),
  full_name text not null,
  role text not null check (role in ('OWNER','MANAGER','GUIDE','CASHIER')),
  phone text,
  email text,
  active boolean default true,
  created_at timestamptz default now()
);

alter table staff_profiles add column if not exists active boolean default true;

create table if not exists crm_clients (
  id uuid primary key default uuid_generate_v4(),
  first_name_th text not null,
  last_name_th text not null,
  first_name_en text not null,
  last_name_en text not null,
  passport_number text,
  visa_status text not null default 'PENDING_NZ_VISA',
  oshc_provider text,
  oshc_policy_number text,
  oshc_expiry date,
  medical_conditions text,
  dietary_requirements text,
  client_tier text not null default 'STANDARD' check (client_tier in ('STANDARD','VIP','VVIP')),
  university text,
  client_email text,
  phone text,
  created_at timestamptz default now()
);

create table if not exists tour_bookings (
  id uuid primary key default uuid_generate_v4(),
  tour_id uuid not null references tours(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  guide_id uuid references staff_profiles(id),
  booking_status text not null default 'PENDING'
    check (booking_status in ('PENDING','DEPOSIT_PAID','FULLY_PAID','CANCELLED')),
  amount_paid_aud numeric(10,2) default 0,
  created_at timestamptz default now(),
  unique (tour_id, client_id)
);

create table if not exists waivers (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid not null references crm_clients(id) on delete cascade,
  agreed_terms boolean not null default false,
  agreed_risk boolean not null default false,
  agreed_medical boolean not null default false,
  agreed_media boolean not null default false,
  agreed_privacy boolean not null default false,
  digital_signature text not null,
  signed_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists client_guide_content (
  id uuid primary key default uuid_generate_v4(),
  dest text not null,
  tab_type text not null check (tab_type in ('content','photo','location','food')),
  title_th text not null,
  title_en text not null,
  payload jsonb not null default '{}',
  sort_order int default 0,
  active boolean default true
);

alter table client_guide_content add column if not exists active boolean default true;

create table if not exists reviews (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references crm_clients(id) on delete set null,
  tour_id uuid references tours(id) on delete set null,
  rating int not null check (rating between 1 and 5),
  title_en text,
  title_th text,
  body_en text not null,
  body_th text not null,
  is_published boolean default false,
  created_at timestamptz default now()
);

create table if not exists gallery (
  id uuid primary key default uuid_generate_v4(),
  tour_id uuid references tours(id) on delete set null,
  dest text not null,
  public_url text not null,
  caption_en text,
  caption_th text,
  like_count int default 0,
  created_at timestamptz default now()
);

create table if not exists gallery_likes (
  id uuid primary key default uuid_generate_v4(),
  gallery_id uuid not null references gallery(id) on delete cascade,
  client_id uuid not null references crm_clients(id) on delete cascade,
  created_at timestamptz default now(),
  unique (gallery_id, client_id)
);

create table if not exists packing_items (
  id uuid primary key default uuid_generate_v4(),
  dest text not null,
  season text not null check (season in ('summer','autumn','winter','spring')),
  category text not null,
  priority text not null check (priority in ('must_have','nice_to_have')),
  label_th text not null,
  label_en text not null,
  weather_note_th text,
  weather_note_en text,
  sort_order int default 0
);

create table if not exists tour_itinerary_days (
  id uuid primary key default uuid_generate_v4(),
  tour_id uuid not null references tours(id) on delete cascade,
  day_number int not null,
  title_en text not null,
  title_th text not null,
  summary_en text,
  summary_th text,
  unique (tour_id, day_number)
);

create table if not exists tour_itinerary_blocks (
  id uuid primary key default uuid_generate_v4(),
  day_id uuid not null references tour_itinerary_days(id) on delete cascade,
  start_time time not null,
  end_time time,
  block_type text not null default 'activity',
  title_en text not null,
  title_th text not null,
  location_name text,
  notes_en text,
  notes_th text,
  sort_order int default 0
);

create table if not exists offline_map_pins (
  id uuid primary key default uuid_generate_v4(),
  dest text not null,
  category text not null,
  name_en text not null,
  name_th text not null,
  address text not null,
  lat numeric,
  lng numeric,
  notes_en text,
  notes_th text,
  sort_order int default 0
);

create table if not exists emergency_contacts (
  id uuid primary key default uuid_generate_v4(),
  dest text not null,
  label_en text not null,
  label_th text not null,
  phone text not null,
  priority int default 10,
  is_oshc_tip boolean default false
);

alter table tours enable row level security;
alter table crm_clients enable row level security;
alter table waivers enable row level security;
alter table tour_bookings enable row level security;
alter table client_guide_content enable row level security;
alter table reviews enable row level security;
alter table gallery enable row level security;
alter table gallery_likes enable row level security;
alter table packing_items enable row level security;
alter table tour_itinerary_days enable row level security;
alter table tour_itinerary_blocks enable row level security;
alter table offline_map_pins enable row level security;
alter table emergency_contacts enable row level security;
alter table staff_profiles enable row level security;
