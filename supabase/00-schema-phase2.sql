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
