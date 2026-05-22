-- Chapter99 — Room management (Settings + Queue + Booking Wizard)
-- Safe if rooms already exists from phase 3 schema

create table if not exists rooms (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null references shops(id) on delete cascade,
  name        text not null,
  active      boolean default true,
  created_at  timestamptz default now()
);

create index if not exists rooms_shop_active on rooms(shop_id, active);

alter table rooms enable row level security;

drop policy if exists "shop_isolation" on rooms;
drop policy if exists "anon_select_rooms" on rooms;
drop policy if exists "anon_insert_rooms" on rooms;
drop policy if exists "anon_update_rooms" on rooms;
drop policy if exists "anon_delete_rooms" on rooms;

create policy "anon_select_rooms" on rooms
  for select to anon, authenticated
  using (shop_id is not null);

create policy "anon_insert_rooms" on rooms
  for insert to anon, authenticated
  with check (shop_id is not null);

create policy "anon_update_rooms" on rooms
  for update to anon, authenticated
  using (true)
  with check (true);

create policy "anon_delete_rooms" on rooms
  for delete to anon, authenticated
  using (true);
