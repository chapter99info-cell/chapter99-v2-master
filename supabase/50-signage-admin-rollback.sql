-- Rollback 50-signage-admin.sql

drop function if exists public.admin_list_signage_assets(text, text);
drop function if exists public.admin_update_signage_config(text, text, int, int);
drop function if exists public.admin_delete_signage_asset(text, text, uuid);
drop function if exists public.admin_upsert_signage_asset(text, text, text, int, boolean, uuid);
drop function if exists public._signage_assert_owner_pin(text, text);

drop table if exists public.signage_config;

-- Note: does not restore 49's direct anon write policies on signage_assets.
-- Re-run 49-signage.sql policy section if needed.

notify pgrst, 'reload schema';
