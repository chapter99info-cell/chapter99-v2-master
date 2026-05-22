-- Chapter99 — In-app booking notifications (Alerts panel)

create table if not exists notifications (
  id          uuid primary key default uuid_generate_v4(),
  shop_id     text not null references shops(id) on delete cascade,
  booking_id  uuid references bookings(id) on delete set null,
  message     text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_shop_unread
  on notifications(shop_id, is_read, created_at desc);

create index if not exists notifications_booking
  on notifications(booking_id);

alter table notifications enable row level security;

drop policy if exists "anon_select_notifications" on notifications;
drop policy if exists "anon_insert_notifications" on notifications;
drop policy if exists "anon_update_notifications" on notifications;

create policy "anon_select_notifications" on notifications
  for select to anon, authenticated
  using (shop_id is not null);

create policy "anon_insert_notifications" on notifications
  for insert to anon, authenticated
  with check (shop_id is not null);

create policy "anon_update_notifications" on notifications
  for update to anon, authenticated
  using (true)
  with check (true);

-- Notify Alerts panel on every new booking (walk-in + online)
create or replace function notify_new_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_name text := 'Walk-in guest';
  v_service_name text := 'Service';
  v_therapist text;
  v_room text;
  v_payload jsonb;
begin
  if NEW.shop_id is null then
    return NEW;
  end if;

  if NEW.client_id is not null then
    select coalesce(nullif(trim(c.name), ''), 'Walk-in guest')
    into v_client_name
    from clients c
    where c.id = NEW.client_id;
  end if;

  if NEW.service_id is not null then
    select coalesce(nullif(trim(s.name_en), ''), 'Service')
    into v_service_name
    from services s
    where s.id = NEW.service_id;
  end if;

  v_therapist := nullif(trim(coalesce(NEW.therapist_name, '')), '');
  if v_therapist is null and NEW.staff_id is not null then
    select nullif(trim(s.name_en), '')
    into v_therapist
    from staff s
    where s.id = NEW.staff_id;
  end if;

  if NEW.room_id is not null then
    select nullif(trim(r.name), '')
    into v_room
    from rooms r
    where r.id = NEW.room_id;
  end if;

  v_payload := jsonb_build_object(
    'type', 'booking',
    'clientName', v_client_name,
    'serviceName', v_service_name,
    'appointmentAt', NEW.start_time,
    'therapist', v_therapist,
    'room', v_room,
    'source', coalesce(NEW.source, 'online'),
    'bookedAt', coalesce(NEW.created_at, now())
  );

  insert into notifications (shop_id, booking_id, message, is_read)
  values (NEW.shop_id, NEW.id, v_payload::text, false);

  return NEW;
end;
$$;

drop trigger if exists trg_booking_notification on bookings;
create trigger trg_booking_notification
  after insert on bookings
  for each row
  execute function notify_new_booking();

-- Realtime badge updates in dashboard
alter table notifications replica identity full;

do $$
begin
  if exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    null;
  elsif exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table notifications;
  end if;
exception
  when undefined_object then null;
  when duplicate_object then null;
end;
$$;
