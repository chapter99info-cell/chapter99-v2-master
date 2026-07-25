-- Rollback Chapter99 digital signage (49-signage.sql)

drop function if exists public.get_signage_data(text);

drop policy if exists "signage_assets_insert" on public.signage_assets;
drop policy if exists "signage_assets_update" on public.signage_assets;
drop policy if exists "signage_assets_delete" on public.signage_assets;
drop policy if exists "signage_assets_select_authenticated" on public.signage_assets;

drop table if exists public.signage_assets;

alter table public.shops drop constraint if exists shops_signage_rotation_check;
alter table public.shops drop column if exists signage_rotation;

notify pgrst, 'reload schema';
