-- RLS for owner dashboard tables (run after 013_trip2talk_owner_tables.sql)

drop policy if exists "anon_read_expenses" on expenses;
drop policy if exists "anon_insert_expenses" on expenses;
drop policy if exists "anon_update_expenses" on expenses;
drop policy if exists "anon_read_commission" on staff_commission_ledger;
drop policy if exists "anon_update_commission" on staff_commission_ledger;

create policy "anon_read_expenses" on expenses for select to anon using (true);
create policy "anon_insert_expenses" on expenses for insert to anon with check (true);
create policy "anon_update_expenses" on expenses for update to anon using (true) with check (true);
create policy "anon_read_commission" on staff_commission_ledger for select to anon using (true);
create policy "anon_update_commission" on staff_commission_ledger for update to anon using (true) with check (true);
