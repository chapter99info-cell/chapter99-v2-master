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
