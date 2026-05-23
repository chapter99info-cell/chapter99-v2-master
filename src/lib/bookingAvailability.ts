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

export function countFreeTherapists(
  bookings: DayBooking[],
  therapistIds: string[],
  slotStart: Date,
  slotEnd: Date
): number {
  if (therapistIds.length === 0) return 0
  return therapistIds.length - countBusyTherapists(bookings, therapistIds, slotStart, slotEnd)
}

/** Couple booking: at least two distinct therapists free for the same slot. */
export function evaluateCoupleSlotAvailability(
  bookings: DayBooking[],
  slotStart: Date,
  slotEnd: Date,
  therapistIds: string[]
): SlotAvailabilityResult {
  const total = therapistIds.length
  const free = countFreeTherapists(bookings, therapistIds, slotStart, slotEnd)

  if (total < 2) {
    return {
      available: false,
      busyTherapists: total - free,
      totalTherapists: total,
      reason: 'Couple booking requires at least 2 therapists on staff',
    }
  }

  if (free < 2) {
    return {
      available: false,
      busyTherapists: total - free,
      totalTherapists: total,
      reason:
        free === 1
          ? 'Only 1 therapist available at this time — cannot book a couple'
          : 'All therapists are booked at this time',
    }
  }

  return {
    available: true,
    busyTherapists: total - free,
    totalTherapists: total,
  }
}

export function filterAvailableCoupleSlots(
  date: string,
  durationMin: number,
  bookings: DayBooking[],
  therapistIds: string[]
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

    const result = evaluateCoupleSlotAvailability(
      bookings,
      slotStart,
      slotEnd,
      therapistIds
    )
    if (result.available) available.push(slotTime)
  }

  return available
}

export interface CoupleTherapistAssignment {
  staff1: string | null
  staff2: string | null
  name1: string
  name2: string
  error?: string
}

/** Assign two different therapists; honours preferences when free. */
export function assignCoupleTherapists(
  bookings: DayBooking[],
  therapistOptions: { id: string; name_en: string }[],
  slotStart: Date,
  slotEnd: Date,
  preferred1?: string | null,
  preferred2?: string | null
): CoupleTherapistAssignment {
  const therapistIds = therapistOptions.map(t => t.id)
  const freeIds = therapistIds.filter(
    id => !isTherapistBusy(bookings, id, slotStart, slotEnd)
  )
  const nameById = (id: string) =>
    therapistOptions.find(t => t.id === id)?.name_en ?? ''

  if (therapistIds.length < 2) {
    return {
      staff1: null,
      staff2: null,
      name1: '',
      name2: '',
      error: 'Couple booking requires at least 2 therapists on staff',
    }
  }

  if (freeIds.length < 2) {
    return {
      staff1: null,
      staff2: null,
      name1: '',
      name2: '',
      error:
        freeIds.length === 1
          ? 'Only 1 therapist available at this time'
          : 'No therapists available at this time',
    }
  }

  if (preferred1 && preferred2 && preferred1 === preferred2) {
    return {
      staff1: null,
      staff2: null,
      name1: '',
      name2: '',
      error: 'Each person must have a different therapist',
    }
  }

  if (preferred1 && !freeIds.includes(preferred1)) {
    return {
      staff1: null,
      staff2: null,
      name1: '',
      name2: '',
      error: 'Person 1’s therapist is not available at this time',
    }
  }

  if (preferred2 && !freeIds.includes(preferred2)) {
    return {
      staff1: null,
      staff2: null,
      name1: '',
      name2: '',
      error: 'Person 2’s therapist is not available at this time',
    }
  }

  let staff1: string | null =
    preferred1 && freeIds.includes(preferred1) ? preferred1 : null
  let staff2: string | null =
    preferred2 && freeIds.includes(preferred2) ? preferred2 : null

  if (!staff1) {
    staff1 = freeIds.find(id => id !== staff2) ?? freeIds[0]
  }
  if (!staff2) {
    staff2 = freeIds.find(id => id !== staff1) ?? null
  }

  if (!staff1 || !staff2 || staff1 === staff2) {
    return {
      staff1: null,
      staff2: null,
      name1: '',
      name2: '',
      error: 'Could not assign two different therapists',
    }
  }

  return {
    staff1,
    staff2,
    name1: preferred1 ? nameById(preferred1) : nameById(staff1),
    name2: preferred2 ? nameById(preferred2) : nameById(staff2),
  }
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
