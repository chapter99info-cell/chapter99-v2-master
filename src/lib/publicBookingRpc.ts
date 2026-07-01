// Phase 1 — Public booking RPC wrappers (dual-path with VITE_BOOKING_RPC_V1)

import { supabase } from './supabase'
import type { DayBooking } from './bookingAvailability'
import type { PublicServiceRow } from './publicBooking'

export interface PublicTherapistRow {
  id: string
  name_en: string
  role: string
}

export interface CreatePublicBookingParams {
  shopId: string
  serviceId: string
  start: string
  end: string
  clientName: string
  clientPhone: string
  clientEmail: string
  medicalNotes?: string | null
  termsAgreed: boolean
  depositRequired: boolean
  depositAmount?: number | null
  staffId?: string | null
  therapistName?: string | null
}

export interface CreatePublicBookingResult {
  ok: boolean
  bookingId?: string
  clientId?: string
  staffId?: string | null
  therapistName?: string | null
  status?: string
  depositAmount?: number | null
  error?: string
  code?: string
}

export interface PublicReviewContext {
  ok: boolean
  shopName?: string
  bookingExists?: boolean
  error?: string
}

/** Default false — enable via VITE_BOOKING_RPC_V1=true after SQL is applied in Supabase. */
export function isBookingRpcV1Enabled(): boolean {
  return import.meta.env.VITE_BOOKING_RPC_V1 === 'true'
}

function mapServiceRow(row: Record<string, unknown>): PublicServiceRow {
  return {
    id: row.id as string,
    name_en: row.name_en as string,
    name_th: (row.name_th as string | null) ?? null,
    duration: Number(row.duration),
    price: Number(row.price),
    gst_free: row.gst_free === true,
    category: (row.category as string) || 'other',
    image_url: (row.image_url as string | null) ?? null,
    sort_order: row.sort_order != null ? Number(row.sort_order) : null,
  }
}

export async function fetchPublicServices(shopId: string): Promise<PublicServiceRow[]> {
  const { data, error } = await supabase.rpc('get_public_services', {
    p_shop_id: shopId,
  })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, unknown>) => mapServiceRow(row))
}

export async function fetchPublicTherapists(shopId: string): Promise<PublicTherapistRow[]> {
  const { data, error } = await supabase.rpc('get_public_therapists', {
    p_shop_id: shopId,
  })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name_en: row.name_en as string,
    role: row.role as string,
  }))
}

export async function fetchPublicTherapistIds(shopId: string): Promise<string[]> {
  const therapists = await fetchPublicTherapists(shopId)
  return therapists.filter(t => t.role === 'therapist').map(t => t.id)
}

export async function fetchPublicDayBookings(
  shopId: string,
  date: string
): Promise<DayBooking[]> {
  const { data, error } = await supabase.rpc('get_day_availability', {
    p_shop_id: shopId,
    p_date: date,
  })

  if (error) throw new Error(error.message)
  return (data ?? []).map((row: Record<string, unknown>) => ({
    start_time: row.start_time as string,
    end_time: row.end_time as string,
    staff_id: (row.staff_id as string | null) ?? null,
  }))
}

export async function createPublicBooking(
  params: CreatePublicBookingParams
): Promise<CreatePublicBookingResult> {
  const { data, error } = await supabase.rpc('create_public_booking', {
    p_shop_id: params.shopId,
    p_service_id: params.serviceId,
    p_start: params.start,
    p_end: params.end,
    p_client_name: params.clientName,
    p_client_phone: params.clientPhone,
    p_client_email: params.clientEmail,
    p_medical_notes: params.medicalNotes ?? null,
    p_terms_agreed: params.termsAgreed,
    p_deposit_required: params.depositRequired,
    p_deposit_amount: params.depositRequired ? params.depositAmount ?? null : null,
    p_staff_id: params.staffId ?? null,
    p_therapist_name: params.therapistName ?? null,
  })

  if (error) {
    return { ok: false, error: error.message, code: 'VALIDATION' }
  }

  const payload = data as Record<string, unknown> | null
  if (!payload?.ok) {
    return {
      ok: false,
      error: (payload?.error as string) ?? 'Booking failed',
      code: (payload?.code as string) ?? 'VALIDATION',
    }
  }

  return {
    ok: true,
    bookingId: payload.booking_id as string,
    clientId: payload.client_id as string,
    staffId: (payload.staff_id as string | null) ?? null,
    therapistName: (payload.therapist_name as string | null) ?? null,
    status: payload.status as string,
    depositAmount:
      payload.deposit_amount != null ? Number(payload.deposit_amount) : null,
  }
}

export async function fetchPublicReviewContext(
  bookingId: string
): Promise<PublicReviewContext> {
  const { data, error } = await supabase.rpc('get_public_review_context', {
    p_booking_id: bookingId,
  })

  if (error) {
    return { ok: false, error: error.message }
  }

  const payload = data as Record<string, unknown> | null
  if (!payload?.ok) {
    return { ok: false, error: (payload?.error as string) ?? 'not_found' }
  }

  return {
    ok: true,
    shopName: payload.shop_name as string,
    bookingExists: payload.booking_exists === true,
  }
}
