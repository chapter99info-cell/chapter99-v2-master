-- Chapter99 V4 — Phase 1: Core Schema + PIN Auth
-- Run FIRST in Supabase SQL Editor

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ── PIN Authentication ────────────────────────────────────────
-- PIN levels: 1111=staff, 4444=cashier, 9999=owner, 3501=super_admin

create table pin_sessions (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null,
  pin_level   text not null,  -- staff/cashier/owner/super_admin
  staff_id    uuid,
  created_at  timestamptz default now(),
  expires_at  timestamptz default now() + interval '8 hours',
  ip_address  text
);

-- Verify PIN function (called from API)
create or replace function verify_pin(
  p_shop_id text,
  p_pin text
) returns jsonb language plpgsql security definer as $$
declare
  v_level text;
  v_staff_id uuid;
  v_staff_name text;
begin
  -- Check shop-level PINs
  if p_pin = '9999' then
    v_level := 'owner';
  elsif p_pin = '4444' then
    v_level := 'cashier';
  elsif p_pin = '3501' then
    v_level := 'super_admin';
  else
    -- Check staff PIN
    select id, name_en into v_staff_id, v_staff_name
    from staff
    where shop_id = p_shop_id
      and pin_hash = crypt(p_pin, pin_hash)
      and active = true
    limit 1;

    if v_staff_id is not null then
      v_level := 'staff';
    else
      return jsonb_build_object('success', false, 'error', 'Invalid PIN');
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'level', v_level,
    'staffId', v_staff_id,
    'staffName', v_staff_name
  );
end;
$$;
