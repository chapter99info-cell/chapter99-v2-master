-- Trip2Talk owner dashboard: expenses + commission ledger (run after 004–005)

create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  tour_id text,
  amount_aud numeric(10,2) not null default 0,
  has_gst boolean not null default true,
  gst_amount_aud numeric(10,2) not null default 0,
  ato_category text not null,
  vendor_name text not null,
  receipt_filename text,
  is_synced boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists expenses_created_at on expenses (created_at desc);

create table if not exists staff_commission_ledger (
  id uuid primary key default uuid_generate_v4(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  tour_id uuid references tours(id) on delete set null,
  amount_aud numeric(10,2) not null default 0,
  description text,
  is_paid boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists staff_commission_ledger_staff on staff_commission_ledger (staff_id, is_paid);

alter table expenses enable row level security;
alter table staff_commission_ledger enable row level security;
