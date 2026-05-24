-- Chapter99 V4 — Services Manager: fix anon RLS (delete / hide / list)
-- Run in Supabase SQL Editor if Delete or Hide does nothing in Owner → Services.
--
-- Legacy shop_isolation uses current_setting('app.shop_id') which the browser never sets.
-- anon_select_active_services only returns active rows, so Hide/Delete can look broken in the manager.

drop policy if exists "shop_isolation" on services;

drop policy if exists "anon_select_services_shop" on services;
create policy "anon_select_services_shop" on services
  for select to anon, authenticated
  using (shop_id is not null);
