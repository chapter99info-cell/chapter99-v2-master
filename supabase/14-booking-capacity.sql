-- Chapter99 — Shop-wide booking capacity: MIN(rooms, therapists) per time slot

-- Anon can read rooms for capacity counts
drop policy if exists "anon_select_rooms" on rooms;
create policy "anon_select_rooms" on rooms
  for select to anon, authenticated
  using (shop_id is not null);

-- Replace lock_slot: shop capacity + optional therapist conflict
create or replace function lock_slot(
  p_shop_id text,
  p_staff_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_session_id text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_count int;
  v_therapist_count int;
  v_capacity int;
  v_overlap int;
  v_staff_conflict int;
begin
  select count(*)::int into v_room_count
  from rooms
  where shop_id = p_shop_id and active = true;

  select count(*)::int into v_therapist_count
  from staff
  where shop_id = p_shop_id
    and active = true
    and role in ('therapist', 'owner', 'manager');

  if coalesce(v_room_count, 0) < 1 then v_room_count := 3; end if;
  if coalesce(v_therapist_count, 0) < 1 then v_therapist_count := 1; end if;
  v_capacity := least(v_room_count, v_therapist_count);

  select count(*)::int into v_overlap
  from bookings
  where shop_id = p_shop_id
    and status not in ('cancelled', 'no_show')
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

  if v_overlap >= v_capacity then
    return jsonb_build_object(
      'available', false,
      'reason', 'This time slot is full',
      'capacity', v_capacity,
      'booked', v_overlap
    );
  end if;

  if p_staff_id is not null then
    select count(*)::int into v_staff_conflict
    from bookings
    where shop_id = p_shop_id
      and staff_id = p_staff_id
      and status not in ('cancelled', 'no_show')
      and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

    if v_staff_conflict > 0 then
      return jsonb_build_object(
        'available', false,
        'reason', 'This therapist is not available',
        'capacity', v_capacity,
        'booked', v_overlap
      );
    end if;
  end if;

  return jsonb_build_object(
    'available', true,
    'capacity', v_capacity,
    'booked', v_overlap,
    'locked_until', (now() + interval '5 minutes')::text
  );
end;
$$;

-- Validate before insert (Booking Wizard / server-side pattern)
create or replace function check_booking_slot(
  p_shop_id text,
  p_start timestamptz,
  p_end timestamptz,
  p_staff_id uuid default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room_count int;
  v_therapist_count int;
  v_capacity int;
  v_overlap int;
  v_staff_conflict int;
begin
  select count(*)::int into v_room_count
  from rooms where shop_id = p_shop_id and active = true;

  select count(*)::int into v_therapist_count
  from staff
  where shop_id = p_shop_id and active = true
    and role in ('therapist', 'owner', 'manager');

  if coalesce(v_room_count, 0) < 1 then v_room_count := 3; end if;
  if coalesce(v_therapist_count, 0) < 1 then v_therapist_count := 1; end if;
  v_capacity := least(v_room_count, v_therapist_count);

  select count(*)::int into v_overlap
  from bookings
  where shop_id = p_shop_id
    and status not in ('cancelled', 'no_show')
    and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

  if v_overlap >= v_capacity then
    return jsonb_build_object('available', false, 'reason', 'This time slot is full');
  end if;

  if p_staff_id is not null then
    select count(*)::int into v_staff_conflict
    from bookings
    where shop_id = p_shop_id and staff_id = p_staff_id
      and status not in ('cancelled', 'no_show')
      and tstzrange(start_time, end_time, '[)') && tstzrange(p_start, p_end, '[)');

    if v_staff_conflict > 0 then
      return jsonb_build_object('available', false, 'reason', 'This therapist is not available');
    end if;
  end if;

  return jsonb_build_object('available', true, 'capacity', v_capacity, 'booked', v_overlap);
end;
$$;

grant execute on function lock_slot(text, uuid, timestamptz, timestamptz, text) to anon, authenticated;
grant execute on function check_booking_slot(text, timestamptz, timestamptz, uuid) to anon, authenticated;
