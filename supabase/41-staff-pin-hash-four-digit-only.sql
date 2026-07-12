-- Chapter99 — staff_pin_hash: only crypt plain 4-digit PINs
-- Run in Supabase SQL Editor if soft-delete / PIN updates behave unexpectedly.
--
-- Some environments hashed ANY non-bcrypt pin_hash change (including soft-delete
-- markers like __deleted__).. The Staff Manager now writes a pre-hashed bcrypt
-- sentinel, but this keeps the trigger aligned with supabase/12-staff-manager-rls.sql.

create extension if not exists pgcrypto;

create or replace function hash_staff_pin()
returns trigger
language plpgsql
as $$
begin
  -- Only hash freshly entered 4-digit PINs. Leave bcrypt hashes and sentinels alone.
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
