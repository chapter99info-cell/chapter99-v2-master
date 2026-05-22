-- Chapter99 — Per-therapist slot validation (replaces shop-wide capacity blocking)
-- Run in Supabase SQL Editor after 14-booking-capacity.sql

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
  v_therapist_count int;
  v_busy_therapists int;
  v_staff_conflict int;
begin
  -- Specific therapist: only that staff member must be free
  if p_staff_id is not null then
    select count(*)::int into v_staff_conflict
    from bookings
    where shop_id = p_shop_id
      and staff_id = p_staff_id
      and status not in ('cancelled', 'no_show')
      and start_time < p_end
      and end_time > p_start;

    if v_staff_conflict > 0 then
      return jsonb_build_object(
        'available', false,
        'reason', 'This therapist is not available at this time'
      );
    end if;

    return jsonb_build_object('available', true);
  end if;

  -- No preference: allow if at least one active therapist is free
  select count(*)::int into v_therapist_count
  from staff
  where shop_id = p_shop_id
    and active = true
    and role = 'therapist';

  if coalesce(v_therapist_count, 0) < 1 then
    return jsonb_build_object('available', true, 'note', 'no therapists configured');
  end if;

  select count(*)::int into v_busy_therapists
  from staff s
  where s.shop_id = p_shop_id
    and s.active = true
    and s.role = 'therapist'
    and exists (
      select 1
      from bookings b
      where b.shop_id = p_shop_id
        and b.staff_id = s.id
        and b.status not in ('cancelled', 'no_show')
        and b.start_time < p_end
        and b.end_time > p_start
    );

  if v_busy_therapists >= v_therapist_count then
    return jsonb_build_object(
      'available', false,
      'reason', 'All therapists are booked at this time',
      'therapists', v_therapist_count,
      'busy', v_busy_therapists
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'therapists', v_therapist_count,
    'busy', v_busy_therapists
  );
end;
$$;

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
  v_check jsonb;
begin
  v_check := check_booking_slot(p_shop_id, p_start, p_end, p_staff_id);

  if not (v_check->>'available')::boolean then
    return v_check;
  end if;

  return v_check || jsonb_build_object(
    'locked_until', (now() + interval '5 minutes')::text
  );
end;
$$;

grant execute on function check_booking_slot(text, timestamptz, timestamptz, uuid) to anon, authenticated;
grant execute on function lock_slot(text, uuid, timestamptz, timestamptz, text) to anon, authenticated;
