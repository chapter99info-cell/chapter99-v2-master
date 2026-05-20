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
