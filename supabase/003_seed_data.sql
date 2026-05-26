-- Trip2Talk V4 — 003 seed data (run after 002_rls_policies.sql)
-- Supabase SQL Editor → project trip2talk-v4

-- ── Demo shop (matches VITE_SHOP_ID=shop-001) ───────────────────────────────
insert into shops (
  id,
  name,
  slug,
  business_type,
  plan,
  active,
  email,
  phone,
  timezone,
  currency,
  gst_registered
)
values (
  'shop-001',
  'Trip2Talk Demo',
  'trip2talk',
  'massage',
  'starter',
  true,
  'hello@trip2talk.app',
  '',
  'Australia/Sydney',
  'AUD',
  true
)
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  business_type = excluded.business_type,
  active = excluded.active;

-- ── Default role PINs (plain 4-digit → hashed by staff_pin_hash trigger) ─────
-- Owner 9999 | Cashier 4444 | Super Admin 3501 | Therapist 1111

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Owner', 'owner', '9999', true
from shops s
where s.id = 'shop-001'
  and not exists (
    select 1 from staff st
    where st.shop_id = s.id and st.role = 'owner' and st.active = true
  );

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Cashier', 'cashier', '4444', true
from shops s
where s.id = 'shop-001'
  and not exists (
    select 1 from staff st
    where st.shop_id = s.id and st.role = 'cashier' and st.active = true
  );

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Super Admin', 'super_admin', '3501', true
from shops s
where s.id = 'shop-001'
  and not exists (
    select 1 from staff st
    where st.shop_id = s.id and st.role = 'super_admin' and st.active = true
  );

insert into staff (shop_id, name_en, role, pin_hash, active)
select s.id, 'Demo Therapist', 'therapist', '1111', true
from shops s
where s.id = 'shop-001'
  and not exists (
    select 1 from staff st
    where st.shop_id = s.id and st.role = 'therapist' and st.active = true
  );

-- ── Sample services (optional — edit or delete) ───────────────────────────────
insert into services (shop_id, name_en, duration, price, gst_free, active, sort_order)
select 'shop-001', v.name_en, v.duration, v.price, v.gst_free, true, v.sort_order
from (
  values
    ('Thai Relaxation 60 min', 60, 95.00, false, 1),
    ('Thai Relaxation 90 min', 90, 130.00, false, 2),
    ('Deep Tissue 60 min', 60, 105.00, false, 3)
) as v(name_en, duration, price, gst_free, sort_order)
where not exists (
  select 1 from services s where s.shop_id = 'shop-001' limit 1
);
