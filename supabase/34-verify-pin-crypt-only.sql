-- Chapter99 V4 — verify_pin: bcrypt-only via staff.pin_hash (no hardcoded PINs)
-- Run in Supabase SQL Editor after prior migrations.
--
-- Replaces shop-level plaintext checks (9999/4444/3501) with staff table lookup.
-- Default role PIN rows are seeded below for shops missing owner/cashier/super_admin
-- (and a demo therapist when a shop has no therapists). Plain 4-digit pin_hash
-- values are hashed by the staff_pin_hash trigger (supabase/12-staff-manager-rls.sql).

create extension if not exists pgcrypto;

create or replace function verify_pin(
  p_shop_id text,
  p_pin text
) returns jsonb language plpgsql security definer as $$
declare
  v_staff_id uuid;
  v_staff_name text;
  v_staff_role text;
  v_level text;
begin
  select id, name_en, role
  into v_staff_id, v_staff_name, v_staff_role
  from staff
  where shop_id = p_shop_id
    and active = true
    and pin_hash = crypt(p_pin, pin_hash)
  limit 1;

  if v_staff_id is null then
    return jsonb_build_object('success', false, 'error', 'Invalid PIN');
  end if;

  v_level := case v_staff_role
    when 'therapist' then 'staff'
    when 'cashier' then 'cashier'
    when 'owner' then 'owner'
    when 'manager' then 'cashier'
    when 'super_admin' then 'super_admin'
    else 'staff'
  end;

  return jsonb_build_object(
    'success', true,
    'level', v_level,
    'staffId', v_staff_id,
    'staffName', v_staff_name
  );
end;
$$;

-- ── Seed default role PIN rows (only when missing) ───────────────────────────
-- Owner PIN 9999, Cashier PIN 4444, Super Admin PIN 3501, demo therapist PIN 1111

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Owner', 'owner', '9999', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'owner' and st.active = true
);

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Cashier', 'cashier', '4444', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'cashier' and st.active = true
);

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Super Admin', 'super_admin', '3501', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'super_admin' and st.active = true
);

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Demo Staff', 'therapist', '1111', true
from shops s
where not exists (
  select 1 from staff st
  where st.shop_id = s.id and st.role = 'therapist' and st.active = true
);
