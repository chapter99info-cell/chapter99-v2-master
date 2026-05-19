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
