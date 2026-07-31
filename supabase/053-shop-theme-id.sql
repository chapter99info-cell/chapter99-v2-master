-- 053 — Landing-page theme selection per shop
-- Safe to re-run in Supabase SQL Editor
-- NULL (default) = keep using the legacy hardcoded HomePage. Existing shops (e.g. Mira) are unaffected.

alter table shops
  add column if not exists theme_id text null;

comment on column shops.theme_id is
  'Landing-page theme id matching ThemeId in src/lib/themeRegistry.ts (e.g. "elegant", "sanctuary"). NULL = legacy default HomePage.';

-- Verify: select id, name, theme_id from shops limit 5;
