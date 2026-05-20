-- Chapter99 V4 — Staff Manager: fix anon RLS + PIN hashing
-- Run in Supabase SQL Editor if staff list is empty or Add Staff fails.
--
-- Cause: legacy "shop_isolation" uses current_setting('app.shop_id') which the
-- browser never sets, blocking anon reads/writes even when 04-anon policies exist.

create extension if not exists pgcrypto;

-- Remove legacy policy (blocks anon when app.shop_id is unset)
drop policy if exists "shop_isolation" on staff;

-- SELECT — Staff Manager needs all staff for this shop (active + inactive)
drop policy if exists "anon_select_active_staff" on staff;
drop policy if exists "anon_select_staff" on staff;
create policy "anon_select_staff" on staff
  for select to anon, authenticated
  using (shop_id is not null);

-- INSERT / UPDATE — Staff Manager CRUD
drop policy if exists "anon_insert_staff" on staff;
create policy "anon_insert_staff" on staff
  for insert to anon, authenticated
  with check (shop_id is not null);

drop policy if exists "anon_update_staff" on staff;
create policy "anon_update_staff" on staff
  for update to anon, authenticated
  using (true)
  with check (true);

-- Hash 4-digit PIN on insert / PIN change (requires pgcrypto)
create or replace function hash_staff_pin()
returns trigger
language plpgsql
as $$
begin
  if new.pin_hash is not null and new.pin_hash ~ '^\d{4}$' then
    new.pin_hash := crypt(new.pin_hash, gen_salt('bf'));
  end if;
  return new;
end;
$$;

drop trigger if exists staff_pin_hash on staff;
create trigger staff_pin_hash
  before insert or update of pin_hash on staff
  for each row execute function hash_staff_pin();
