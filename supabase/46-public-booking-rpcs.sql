-- Chapter99 Phase 1 — Public booking RPCs (SECURITY DEFINER)
-- Run in Supabase SQL Editor AFTER review. Does NOT change RLS policies.
-- Prerequisite: check_booking_slot exists (16-booking-therapist-slots.sql).
-- Rollback: 46-public-booking-rpcs-rollback.sql

-- ── get_public_services ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_services(p_shop_id text)
RETURNS TABLE (
  id         uuid,
  name_en    text,
  name_th    text,
  duration   int,
  price      numeric,
  gst_free   boolean,
  category   text,
  image_url  text,
  sort_order int
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.name_en,
    s.name_th,
    s.duration,
    s.price,
    s.gst_free,
    COALESCE(s.category, 'other') AS category,
    s.image_url,
    s.sort_order
  FROM services s
  INNER JOIN shops sh ON sh.id = s.shop_id
  WHERE s.shop_id = p_shop_id
    AND sh.active = true
    AND s.active = true
  ORDER BY s.sort_order ASC NULLS LAST, s.name_en ASC;
$$;

-- ── get_public_therapists ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_therapists(p_shop_id text)
RETURNS TABLE (
  id       uuid,
  name_en  text,
  role     text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    st.id,
    st.name_en,
    st.role
  FROM staff st
  INNER JOIN shops sh ON sh.id = st.shop_id
  WHERE st.shop_id = p_shop_id
    AND sh.active = true
    AND st.active = true
    AND st.role IN ('therapist', 'owner', 'manager')
  ORDER BY st.name_en ASC;
$$;

-- ── get_day_availability ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_day_availability(p_shop_id text, p_date date)
RETURNS TABLE (
  start_time timestamptz,
  end_time   timestamptz,
  staff_id   uuid
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    b.start_time,
    b.end_time,
    b.staff_id
  FROM bookings b
  INNER JOIN shops sh ON sh.id = b.shop_id
  WHERE b.shop_id = p_shop_id
    AND sh.active = true
    AND b.start_time >= (p_date::text || 'T00:00:00+10:00')::timestamptz
    AND b.start_time <= (p_date::text || 'T23:59:59+10:00')::timestamptz
    AND b.status NOT IN ('cancelled', 'no_show');
$$;

-- ── create_public_booking ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION create_public_booking(
  p_shop_id          text,
  p_service_id       uuid,
  p_start            timestamptz,
  p_end              timestamptz,
  p_client_name      text,
  p_client_phone     text,
  p_client_email     text,
  p_medical_notes    text DEFAULT NULL,
  p_terms_agreed     boolean DEFAULT false,
  p_deposit_required boolean DEFAULT false,
  p_deposit_amount   numeric DEFAULT NULL,
  p_staff_id         uuid DEFAULT NULL,
  p_therapist_name   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_active   boolean;
  v_service       record;
  v_slot          jsonb;
  v_client_id     uuid;
  v_booking_id    uuid;
  v_status        text;
  v_duration_min  numeric;
BEGIN
  IF NOT COALESCE(p_terms_agreed, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Terms must be accepted',
      'code', 'VALIDATION'
    );
  END IF;

  IF NULLIF(trim(p_client_name), '') IS NULL
     OR NULLIF(trim(p_client_email), '') IS NULL
     OR NULLIF(trim(p_client_phone), '') IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Name, phone, and email are required',
      'code', 'VALIDATION'
    );
  END IF;

  SELECT sh.active INTO v_shop_active
  FROM shops sh
  WHERE sh.id = p_shop_id;

  IF NOT FOUND OR NOT COALESCE(v_shop_active, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Shop not found or inactive',
      'code', 'SHOP_INACTIVE'
    );
  END IF;

  SELECT s.id, s.duration, s.active
  INTO v_service
  FROM services s
  WHERE s.id = p_service_id
    AND s.shop_id = p_shop_id;

  IF NOT FOUND OR NOT COALESCE(v_service.active, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Service not found',
      'code', 'VALIDATION'
    );
  END IF;

  v_duration_min := EXTRACT(EPOCH FROM (p_end - p_start)) / 60.0;
  IF abs(v_duration_min - v_service.duration) > 1 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'Booking duration does not match service',
      'code', 'VALIDATION'
    );
  END IF;

  IF p_staff_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM staff st
      WHERE st.id = p_staff_id
        AND st.shop_id = p_shop_id
        AND st.active = true
        AND st.role IN ('therapist', 'owner', 'manager')
    ) THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'Invalid therapist',
        'code', 'VALIDATION'
      );
    END IF;
  END IF;

  v_slot := check_booking_slot(p_shop_id, p_start, p_end, p_staff_id);
  IF NOT COALESCE((v_slot->>'available')::boolean, false) THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', COALESCE(v_slot->>'reason', 'This time slot is no longer available'),
      'code', 'SLOT_UNAVAILABLE'
    );
  END IF;

  INSERT INTO clients (shop_id, name, phone, email)
  VALUES (
    p_shop_id,
    trim(p_client_name),
    trim(p_client_phone),
    trim(p_client_email)
  )
  RETURNING id INTO v_client_id;

  v_status := CASE
    WHEN COALESCE(p_deposit_required, false) THEN 'pending_deposit'
    ELSE 'confirmed'
  END;

  INSERT INTO bookings (
    shop_id,
    client_id,
    service_id,
    staff_id,
    therapist_name,
    start_time,
    end_time,
    status,
    source,
    medical_notes,
    deposit_amount,
    deposit_paid,
    terms_agreed,
    terms_agreed_at
  )
  VALUES (
    p_shop_id,
    v_client_id,
    p_service_id,
    p_staff_id,
    NULLIF(trim(p_therapist_name), ''),
    p_start,
    p_end,
    v_status,
    'online',
    NULLIF(trim(p_medical_notes), ''),
    CASE WHEN COALESCE(p_deposit_required, false) THEN p_deposit_amount ELSE NULL END,
    false,
    true,
    now()
  )
  RETURNING id INTO v_booking_id;

  RETURN jsonb_build_object(
    'ok', true,
    'booking_id', v_booking_id,
    'client_id', v_client_id,
    'staff_id', p_staff_id,
    'therapist_name', NULLIF(trim(p_therapist_name), ''),
    'status', v_status,
    'deposit_amount', CASE WHEN COALESCE(p_deposit_required, false) THEN p_deposit_amount ELSE NULL END
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', SQLERRM,
      'code', 'VALIDATION'
    );
END;
$$;

-- ── get_public_review_context ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_public_review_context(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_shop_name text;
BEGIN
  SELECT sh.name
  INTO v_shop_name
  FROM bookings b
  INNER JOIN shops sh ON sh.id = b.shop_id
  WHERE b.id = p_booking_id;

  IF v_shop_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'shop_name', v_shop_name,
    'booking_exists', true
  );
END;
$$;

-- ── Grants (anon + authenticated — public booking wizard) ─────────────────────
GRANT EXECUTE ON FUNCTION get_public_services(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_therapists(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_day_availability(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION create_public_booking(
  text, uuid, timestamptz, timestamptz, text, text, text,
  text, boolean, boolean, numeric, uuid, text
) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_public_review_context(uuid) TO anon, authenticated;
