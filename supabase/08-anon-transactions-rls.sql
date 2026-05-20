-- Chapter99 V4 — Anon read/write for transactions (POS sync + Owner revenue dashboard)
-- Run in Supabase SQL Editor if revenue summary returns empty or permission errors.

drop policy if exists "anon_select_transactions" on transactions;
create policy "anon_select_transactions" on transactions
  for select to anon, authenticated
  using (shop_id is not null);

drop policy if exists "anon_insert_transactions" on transactions;
create policy "anon_insert_transactions" on transactions
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_transactions" on transactions;
create policy "anon_update_transactions" on transactions
  for update to anon, authenticated
  using (true)
  with check (true);
