-- 48 — Per-shop feature overrides (Super Admin PIN 3501)
-- Safe to re-run in Supabase SQL Editor

alter table shops
  add column if not exists feature_overrides jsonb not null default '{}'::jsonb;

comment on column shops.feature_overrides is
  'Super Admin per-shop feature toggles, e.g. {"pos": true, "staff_management": false}. Empty {} = follow plan tier.';

-- Backfill any legacy nulls (if column existed without NOT NULL)
update shops
set feature_overrides = '{}'::jsonb
where feature_overrides is null;

-- Verify: select id, name, feature_overrides from shops limit 3;
