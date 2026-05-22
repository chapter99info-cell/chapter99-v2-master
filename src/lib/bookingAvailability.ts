// Chapter99 — booking slot availability (per-therapist)

import type { SupabaseClient } from '@supabase/supabase-js'

export const INACTIVE_BOOKING_STATUSES = ['cancelled', 'no_show'] as const

/** Staff who can take appointments (online booking staff list) */
export const BOOKABLE_STAFF_ROLES = ['therapist', 'owner', 'manager'] as const

const SYDNEY_OFFSET = '+10:00'

export interface DayBooking {
  start_time: string
  end_time: string
  staff_id?: string | null
}

export interface SlotAvailabilityResult {
  available: boolean
  busyTherapists: number
  totalTherapists: number
  reason?: string
}

export function overlaps(
  slotStart: Date,
  slotEnd: Date,
  bookingStart: Date,
  bookingEnd: Date
): boolean {
  return slotStart < bookingEnd && slotEnd > bookingStart
}

export function isTherapistBusy(
  bookings: DayBooking[],
  staffId: string,
  slotStart: Date,
  slotEnd: Date
): boolean {
  return bookings.some(
    b =>
      b.staff_id === staffId &&
      overlaps(slotStart, slotEnd, new Date(b.start_time), new Date(b.end_time))
  )
}

export function countBusyTherapists(
  bookings: DayBooking[],
  therapistIds: string[],
  slotStart: Date,
  slotEnd: Date
): number {
  return therapistIds.filter(id =>
    isTherapistBusy(bookings, id, slotStart, slotEnd)
  ).length
}

/** Per-therapist rules: specific staff OR at least one free therapist. */
export function evaluateSlotAvailability(
  bookings: DayBooking[],
  slotStart: Date,
  slotEnd: Date,
  therapistIds: string[],
  staffId?: string | null
): SlotAvailabilityResult {
  const total = therapistIds.length

  if (staffId) {
    const busy = isTherapistBusy(bookings, staffId, slotStart, slotEnd)
    if (busy) {
      return {
        available: false,
        busyTherapists: 1,
        totalTherapists: Math.max(total, 1),
        reason: 'This therapist is not available at this time',
      }
    }
    return {
      available: true,
      busyTherapists: 0,
      totalTherapists: Math.max(total, 1),
    }
  }

  if (total === 0) {
    return { available: true, busyTherapists: 0, totalTherapists: 0 }
  }

  const busy = countBusyTherapists(bookings, therapistIds, slotStart, slotEnd)
  if (busy >= total) {
    return {
      available: false,
      busyTherapists: busy,
      totalTherapists: total,
      reason: 'All therapists are booked at this time',
    }
  }

  return { available: true, busyTherapists: busy, totalTherapists: total }
}

export function dayBoundsSydney(date: string): { dayStart: string; dayEnd: string } {
  return {
    dayStart: `${date}T00:00:00${SYDNEY_OFFSET}`,
    dayEnd: `${date}T23:59:59${SYDNEY_OFFSET}`,
  }
}

export function slotWindow(date: string, timeHHMM: string, durationMin: number): {
  slotStart: Date
  slotEnd: Date
} {
  const slotStart = new Date(`${date}T${timeHHMM}:00${SYDNEY_OFFSET}`)
  const slotEnd = new Date(slotStart.getTime() + durationMin * 60_000)
  return { slotStart, slotEnd }
}

export async function fetchTherapistIds(
  supabase: SupabaseClient,
  shopId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('staff')
    .select('id')
    .eq('shop_id', shopId)
    .eq('active', true)
    .eq('role', 'therapist')

  if (error) throw new Error(error.message)
  return (data ?? []).map(row => row.id as string)
}

export async function fetchDayBookings(
  supabase: SupabaseClient,
  shopId: string,
  date: string
): Promise<DayBooking[]> {
  const { dayStart, dayEnd } = dayBoundsSydney(date)

  const { data, error } = await supabase
    .from('bookings')
    .select('start_time, end_time, staff_id')
    .eq('shop_id', shopId)
    .gte('start_time', dayStart)
    .lte('start_time', dayEnd)
    .not('status', 'in', `(${INACTIVE_BOOKING_STATUSES.map(s => `"${s}"`).join(',')})`)

  if (error) throw new Error(error.message)
  return (data ?? []) as DayBooking[]
}

export async function assertSlotAvailable(
  supabase: SupabaseClient,
  shopId: string,
  date: string,
  timeHHMM: string,
  durationMin: number,
  staffId?: string | null
): Promise<SlotAvailabilityResult> {
  const [therapistIds, bookings] = await Promise.all([
    fetchTherapistIds(supabase, shopId),
    fetchDayBookings(supabase, shopId, date),
  ])
  const { slotStart, slotEnd } = slotWindow(date, timeHHMM, durationMin)
  return evaluateSlotAvailability(bookings, slotStart, slotEnd, therapistIds, staffId)
}

/** Preset slots 10:00–20:00 every 30 minutes */
export function generatePresetSlotTimes(): string[] {
  const slots: string[] = []
  for (let h = 10; h <= 19; h++) {
    for (let m = 0; m < 60; m += 30) {
      slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return slots
}

export function filterAvailableSlots(
  date: string,
  durationMin: number,
  bookings: DayBooking[],
  therapistIds: string[],
  staffId?: string | null
): string[] {
  const available: string[] = []
  const businessCloseHour = 20

  for (const slotTime of generatePresetSlotTimes()) {
    const { slotStart, slotEnd } = slotWindow(date, slotTime, durationMin)
    if (
      slotEnd.getHours() > businessCloseHour ||
      (slotEnd.getHours() === businessCloseHour && slotEnd.getMinutes() > 0)
    ) {
      continue
    }

    const result = evaluateSlotAvailability(
      bookings,
      slotStart,
      slotEnd,
      therapistIds,
      staffId
    )
    if (result.available) {
      available.push(slotTime)
    }
  }

  return available
}

/** @deprecated use fetchTherapistIds — kept for any legacy imports */
export async function fetchShopCapacity(
  supabase: SupabaseClient,
  shopId: string
): Promise<{ therapistCount: number; maxConcurrent: number; roomCount: number }> {
  const ids = await fetchTherapistIds(supabase, shopId)
  const n = Math.max(ids.length, 1)
  return { roomCount: n, therapistCount: n, maxConcurrent: n }
}
