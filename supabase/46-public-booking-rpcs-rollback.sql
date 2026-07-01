-- Rollback: 46-public-booking-rpcs.sql
-- Run only if Phase 1 RPCs must be removed. App should set VITE_BOOKING_RPC_V1=false first.

DROP FUNCTION IF EXISTS get_public_review_context(uuid);
DROP FUNCTION IF EXISTS create_public_booking(
  text, uuid, timestamptz, timestamptz, text, text, text,
  text, boolean, boolean, numeric, uuid, text
);
DROP FUNCTION IF EXISTS get_day_availability(text, date);
DROP FUNCTION IF EXISTS get_public_therapists(text);
DROP FUNCTION IF EXISTS get_public_services(text);
