// Chapter99 — booking slot capacity: MIN(active rooms, available therapists)

import type { SupabaseClient } from '@supabase/supabase-js'

export const INACTIVE_BOOKING_STATUSES = ['cancelled', 'no_show'] as const

/** Staff who can take appointments (excludes cashier-only) */
export const BOOKABLE_STAFF_ROLES = ['therapist', 'owner', 'manager'] as const

const DEFAULT_ROOM_COUNT = 3
const DEFAULT_THERAPIST_COUNT = 1
const SYDNEY_OFFSET = '+10:00'

export interface ShopCapacity {
  roomCount: number
  therapistCount: number
  maxConcurrent: number
}

export interface DayBooking {
  start_time: string
  end_time: string
  staff_id?: string | null
}

export interface SlotAvailabilityResult {
  available: boolean
  overlapCount: number
  maxConcurrent: number
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

export function countOverlappingBookings(
  bookings: DayBooking[],
  slotStart: Date,
  slotEnd: Date
): number {
  return bookings.filter(b => {
    const bStart = new Date(b.start_time)
    const bEnd = new Date(b.end_time)
    return overlaps(slotStart, slotEnd, bStart, bEnd)
  }).length
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

export function evaluateSlotAvailability(
  bookings: DayBooking[],
  slotStart: Date,
  slotEnd: Date,
  capacity: ShopCapacity,
  staffId?: string | null
): SlotAvailabilityResult {
  const overlapCount = countOverlappingBookings(bookings, slotStart, slotEnd)
  const maxConcurrent = capacity.maxConcurrent

  if (overlapCount >= maxConcurrent) {
    return {
      available: false,
      overlapCount,
      maxConcurrent,
      reason: `This time slot is full (${overlapCount}/${maxConcurrent} booked)`,
    }
  }

  if (staffId && isTherapistBusy(bookings, staffId, slotStart, slotEnd)) {
    return {
      available: false,
      overlapCount,
      maxConcurrent,
      reason: 'This therapist is not available at this time',
    }
  }

  return { available: true, overlapCount, maxConcurrent }
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

export async function fetchShopCapacity(
  supabase: SupabaseClient,
  shopId: string
): Promise<ShopCapacity> {
  const [roomsRes, staffRes] = await Promise.all([
    supabase
      .from('rooms')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('active', true),
    supabase
      .from('staff')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .eq('active', true)
      .in('role', [...BOOKABLE_STAFF_ROLES]),
  ])

  const roomCount = Math.max(roomsRes.count ?? 0, 0)
  const therapistCount = Math.max(staffRes.count ?? 0, 0)

  const rooms = roomCount > 0 ? roomCount : DEFAULT_ROOM_COUNT
  const therapists = therapistCount > 0 ? therapistCount : DEFAULT_THERAPIST_COUNT
  const maxConcurrent = Math.max(1, Math.min(rooms, therapists))

  return { roomCount: rooms, therapistCount: therapists, maxConcurrent }
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
  const [capacity, bookings] = await Promise.all([
    fetchShopCapacity(supabase, shopId),
    fetchDayBookings(supabase, shopId, date),
  ])
  const { slotStart, slotEnd } = slotWindow(date, timeHHMM, durationMin)
  return evaluateSlotAvailability(bookings, slotStart, slotEnd, capacity, staffId)
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
  capacity: ShopCapacity,
  staffId?: string | null
): string[] {
  const available: string[] = []
  const businessCloseHour = 20

  for (const slotTime of generatePresetSlotTimes()) {
    const { slotStart, slotEnd } = slotWindow(date, slotTime, durationMin)
    if (slotEnd.getHours() > businessCloseHour || (slotEnd.getHours() === businessCloseHour && slotEnd.getMinutes() > 0)) {
      continue
    }

    const result = evaluateSlotAvailability(bookings, slotStart, slotEnd, capacity, staffId)
    if (result.available) {
      available.push(slotTime)
    }
  }

  return available
}
