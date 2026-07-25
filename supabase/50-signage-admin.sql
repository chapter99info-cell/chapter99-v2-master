-- Chapter99 — Signage admin RPCs (PIN-gated via verify_pin)
-- Creates signage_config; revokes direct anon/authenticated table DML;
-- writes only through SECURITY DEFINER RPCs.
-- Prerequisite: 49-signage.sql, verify_pin (34-verify-pin-crypt-only.sql)
-- Rollback: 50-signage-admin-rollback.sql

-- ── signage_config (per-shop rotation + cache refresh interval) ─────────────
create table if not exists public.signage_config (
  shop_id text primary key references public.shops (id) on delete cascade,
  rotation int not null default 0
    check (rotation in (0, 90, 180, 270)),
  refresh_interval_minutes int not null default 360
    check (refresh_interval_minutes >= 1 and refresh_interval_minutes <= 10080),
  updated_at timestamptz not null default now()
);

alter table public.signage_config enable row level security;

-- Seed config rows for existing shops (idempotent)
insert into public.signage_config (shop_id, rotation, refresh_interval_minutes)
select
  s.id,
  coalesce(s.signage_rotation, 0),
  360
from public.shops s
on conflict (shop_id) do nothing;

-- ── Revoke direct table access — RPC only ───────────────────────────────────
revoke all on table public.signage_assets from anon, authenticated;
revoke all on table public.signage_config from anon, authenticated;

drop policy if exists "signage_assets_insert" on public.signage_assets;
drop policy if exists "signage_assets_update" on public.signage_assets;
drop policy if exists "signage_assets_delete" on public.signage_assets;
drop policy if exists "signage_assets_select_authenticated" on public.signage_assets;
drop policy if exists "signage_assets_select" on public.signage_assets;

drop policy if exists "signage_config_select" on public.signage_config;
drop policy if exists "signage_config_insert" on public.signage_config;
drop policy if exists "signage_config_update" on public.signage_config;
drop policy if exists "signage_config_delete" on public.signage_config;
drop policy if exists "signage_config_all" on public.signage_config;

-- Keep RLS enabled with zero policies for anon/authenticated → deny direct access.
-- SECURITY DEFINER RPCs bypass RLS as the function owner.

-- ── Helper: owner / super_admin PIN gate (uses existing verify_pin jsonb) ───
create or replace function public._signage_assert_owner_pin(
  p_shop_id text,
  p_pin text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth jsonb;
  v_level text;
begin
  v_auth := public.verify_pin(p_shop_id, p_pin);
  if coalesce((v_auth->>'success')::boolean, false) is not true then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_auth->>'error', 'Invalid PIN')
    );
  end if;

  v_level := v_auth->>'level';
  if v_level is distinct from 'owner' and v_level is distinct from 'super_admin' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Owner or Super Admin PIN required'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'level', v_level,
    'staffId', v_auth->>'staffId',
    'staffName', v_auth->>'staffName'
  );
end;
$$;

revoke all on function public._signage_assert_owner_pin(text, text) from public;
revoke all on function public._signage_assert_owner_pin(text, text) from anon, authenticated;

-- ── admin_upsert_signage_asset ──────────────────────────────────────────────
create or replace function public.admin_upsert_signage_asset(
  p_shop_id text,
  p_pin text,
  p_video_url text,
  p_sort_order int default 0,
  p_active boolean default true,
  p_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate jsonb;
  v_id uuid;
  v_row public.signage_assets%rowtype;
begin
  v_gate := public._signage_assert_owner_pin(p_shop_id, p_pin);
  if (v_gate->>'ok')::boolean is not true then
    return v_gate;
  end if;

  if p_video_url is null or length(trim(p_video_url)) = 0 then
    return jsonb_build_object('ok', false, 'error', 'video_url required');
  end if;

  if p_id is not null then
    update public.signage_assets
    set
      video_url = trim(p_video_url),
      sort_order = coalesce(p_sort_order, 0),
      active = coalesce(p_active, true)
    where id = p_id
      and shop_id = p_shop_id
    returning * into v_row;

    if v_row.id is null then
      return jsonb_build_object('ok', false, 'error', 'asset_not_found');
    end if;
  else
    insert into public.signage_assets (shop_id, video_url, sort_order, active)
    values (
      p_shop_id,
      trim(p_video_url),
      coalesce(p_sort_order, 0),
      coalesce(p_active, true)
    )
    returning * into v_row;
  end if;

  return jsonb_build_object(
    'ok', true,
    'asset', jsonb_build_object(
      'id', v_row.id,
      'shopId', v_row.shop_id,
      'videoUrl', v_row.video_url,
      'sortOrder', v_row.sort_order,
      'active', v_row.active,
      'createdAt', v_row.created_at
    )
  );
end;
$$;

-- ── admin_delete_signage_asset ──────────────────────────────────────────────
create or replace function public.admin_delete_signage_asset(
  p_shop_id text,
  p_pin text,
  p_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate jsonb;
  v_deleted uuid;
begin
  v_gate := public._signage_assert_owner_pin(p_shop_id, p_pin);
  if (v_gate->>'ok')::boolean is not true then
    return v_gate;
  end if;

  delete from public.signage_assets
  where id = p_id
    and shop_id = p_shop_id
  returning id into v_deleted;

  if v_deleted is null then
    return jsonb_build_object('ok', false, 'error', 'asset_not_found');
  end if;

  return jsonb_build_object('ok', true, 'id', v_deleted);
end;
$$;

-- ── admin_update_signage_config ─────────────────────────────────────────────
create or replace function public.admin_update_signage_config(
  p_shop_id text,
  p_pin text,
  p_rotation int default null,
  p_refresh_interval_minutes int default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate jsonb;
  v_rot int;
  v_mins int;
  v_row public.signage_config%rowtype;
begin
  v_gate := public._signage_assert_owner_pin(p_shop_id, p_pin);
  if (v_gate->>'ok')::boolean is not true then
    return v_gate;
  end if;

  insert into public.signage_config (shop_id, rotation, refresh_interval_minutes)
  values (p_shop_id, 0, 360)
  on conflict (shop_id) do nothing;

  select * into v_row from public.signage_config where shop_id = p_shop_id;

  v_rot := coalesce(p_rotation, v_row.rotation);
  v_mins := coalesce(p_refresh_interval_minutes, v_row.refresh_interval_minutes);

  if v_rot not in (0, 90, 180, 270) then
    return jsonb_build_object('ok', false, 'error', 'rotation must be 0, 90, 180, or 270');
  end if;
  if v_mins < 1 or v_mins > 10080 then
    return jsonb_build_object('ok', false, 'error', 'refresh_interval_minutes out of range');
  end if;

  update public.signage_config
  set
    rotation = v_rot,
    refresh_interval_minutes = v_mins,
    updated_at = now()
  where shop_id = p_shop_id
  returning * into v_row;

  -- Keep shops.signage_rotation in sync for get_signage_data fallback
  update public.shops
  set signage_rotation = v_rot
  where id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'config', jsonb_build_object(
      'shopId', v_row.shop_id,
      'rotation', v_row.rotation,
      'refreshIntervalMinutes', v_row.refresh_interval_minutes,
      'updatedAt', v_row.updated_at
    )
  );
end;
$$;

-- ── admin_list_signage_assets (owner PIN — for manager UI) ──────────────────
create or replace function public.admin_list_signage_assets(
  p_shop_id text,
  p_pin text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gate jsonb;
  v_assets jsonb;
  v_config jsonb;
begin
  v_gate := public._signage_assert_owner_pin(p_shop_id, p_pin);
  if (v_gate->>'ok')::boolean is not true then
    return v_gate;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', a.id,
      'videoUrl', a.video_url,
      'sortOrder', a.sort_order,
      'active', a.active,
      'createdAt', a.created_at
    )
    order by a.sort_order asc nulls last, a.created_at asc
  ), '[]'::jsonb)
  into v_assets
  from public.signage_assets a
  where a.shop_id = p_shop_id;

  select jsonb_build_object(
    'rotation', coalesce(c.rotation, s.signage_rotation, 0),
    'refreshIntervalMinutes', coalesce(c.refresh_interval_minutes, 360)
  )
  into v_config
  from public.shops s
  left join public.signage_config c on c.shop_id = s.id
  where s.id = p_shop_id;

  return jsonb_build_object(
    'ok', true,
    'assets', v_assets,
    'config', coalesce(v_config, jsonb_build_object('rotation', 0, 'refreshIntervalMinutes', 360))
  );
end;
$$;

-- ── Extend get_signage_data with config refresh interval + rotation ─────────
create or replace function public.get_signage_data(p_shop_id text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_shop record;
  v_rot int;
  v_mins int;
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

  select
    coalesce(c.rotation, v_shop.signage_rotation, 0),
    coalesce(c.refresh_interval_minutes, 360)
  into v_rot, v_mins
  from (select 1) _
  left join public.signage_config c on c.shop_id = p_shop_id;

  select json_build_object(
    'ok', true,
    'error', null,
    'shop', json_build_object(
      'id', v_shop.id,
      'name', v_shop.name,
      'slug', v_shop.slug,
      'themeColor', coalesce(v_shop.theme_color, '#0F6E56'),
      'logoUrl', v_shop.logo_url,
      'rotation', v_rot,
      'refreshIntervalMinutes', v_mins
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
grant execute on function public.admin_upsert_signage_asset(text, text, text, int, boolean, uuid) to anon, authenticated;
grant execute on function public.admin_delete_signage_asset(text, text, uuid) to anon, authenticated;
grant execute on function public.admin_update_signage_config(text, text, int, int) to anon, authenticated;
grant execute on function public.admin_list_signage_assets(text, text) to anon, authenticated;

notify pgrst, 'reload schema';
