-- Chapter99 — Digital Signage (Fully Kiosk / Fire Stick)
-- Table signage_assets + shops.signage_rotation + get_signage_data RPC
-- Public display reads ONLY via SECURITY DEFINER RPC (no anon SELECT on base table).
-- Rollback: 49-signage-rollback.sql

-- ── shops.signage_rotation (0 | 90 | 180 | 270) ─────────────────────────────
alter table public.shops
  add column if not exists signage_rotation int not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'shops_signage_rotation_check'
  ) then
    alter table public.shops
      add constraint shops_signage_rotation_check
      check (signage_rotation in (0, 90, 180, 270));
  end if;
end $$;

-- ── signage_assets ────────────────────────────────────────────────────────────
create table if not exists public.signage_assets (
  id          uuid primary key default gen_random_uuid(),
  shop_id     text not null references public.shops (id) on delete cascade,
  video_url   text not null,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists signage_assets_shop_sort_idx
  on public.signage_assets (shop_id, sort_order);

create index if not exists signage_assets_shop_active_idx
  on public.signage_assets (shop_id)
  where active = true;

alter table public.signage_assets enable row level security;

-- No anon/authenticated SELECT on base table — public reads go through get_signage_data.
drop policy if exists "signage_assets_select" on public.signage_assets;
drop policy if exists "signage_assets_insert" on public.signage_assets;
drop policy if exists "signage_assets_update" on public.signage_assets;
drop policy if exists "signage_assets_delete" on public.signage_assets;

-- Staff/owner dashboard writes (PIN session uses anon key; shop_id scoped in app)
create policy "signage_assets_insert" on public.signage_assets
  for insert to anon, authenticated
  with check (shop_id is not null);

create policy "signage_assets_update" on public.signage_assets
  for update to anon, authenticated
  using (shop_id is not null)
  with check (shop_id is not null);

create policy "signage_assets_delete" on public.signage_assets
  for delete to anon, authenticated
  using (shop_id is not null);

-- Authenticated SELECT for owner managers only (still no open anon SELECT)
create policy "signage_assets_select_authenticated" on public.signage_assets
  for select to authenticated
  using (shop_id is not null);

-- ── get_signage_data — public-safe payload for Fire Stick display ─────────────
create or replace function public.get_signage_data(p_shop_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop record;
  v_result json;
begin
  select
    sh.id,
    sh.name,
    sh.slug,
    sh.theme_color,
    sh.logo_url,
    coalesce(sh.signage_rotation, 0) as signage_rotation,
    sh.active
  into v_shop
  from public.shops sh
  where sh.id = p_shop_id
  limit 1;

  if v_shop.id is null or v_shop.active is not true then
    return json_build_object(
      'ok', false,
      'error', 'shop_not_found',
      'shop', null,
      'services', '[]'::json,
      'assets', '[]'::json
    );
  end if;

  select json_build_object(
    'ok', true,
    'error', null,
    'shop', json_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'slug', v_shop.slug,
      'themeColor', coalesce(v_shop.theme_color, '#0F6E56'),
      'logoUrl', v_shop.logo_url,
      'rotation', v_shop.signage_rotation
    ),
    'services', coalesce((
      select json_agg(
        json_build_object(
          'id', s.id,
          'nameEn', s.name_en,
          'nameTh', s.name_th,
          'duration', s.duration,
          'price', s.price,
          'category', coalesce(s.category, 'other'),
          'sortOrder', s.sort_order
        )
        order by s.sort_order asc nulls last, s.name_en asc
      )
      from public.services s
      where s.shop_id = p_shop_id
        and s.active = true
    ), '[]'::json),
    'assets', coalesce((
      select json_agg(
        json_build_object(
          'id', a.id,
          'videoUrl', a.video_url,
          'sortOrder', a.sort_order
        )
        order by a.sort_order asc nulls last, a.created_at asc
      )
      from public.signage_assets a
      where a.shop_id = p_shop_id
        and a.active = true
        and a.video_url is not null
        and length(trim(a.video_url)) > 0
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.get_signage_data(text) to anon, authenticated;

-- Realtime: services price overlay (signage page filters by shop_id)
do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'services'
  ) then
    null;
  elsif exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.services;
  end if;
end $$;

notify pgrst, 'reload schema';
