import {
  countFreeTherapists,
  dayBoundsSydney,
  evaluateSlotAvailability,
  filterAvailableSlots,
  generatePresetSlotTimes,
  slotWindow,
  type DayBooking,
} from './bookingAvailability'
import { getPublicAppOrigin } from './menuUrl'

export type PublicWizardStep =
  | 'service'
  | 'datetime'
  | 'details'
  | 'confirm'
  | 'deposit'
  | 'done'

export const PUBLIC_STEPS: { id: PublicWizardStep; label: string }[] = [
  { id: 'service', label: 'Service' },
  { id: 'datetime', label: 'Date & Time' },
  { id: 'details', label: 'Your Details' },
  { id: 'confirm', label: 'Confirm' },
]

export interface PublicServiceRow {
  id: string
  name_en: string
  name_th: string | null
  duration: number
  price: number
  gst_free: boolean
  category: string
  image_url: string | null
  sort_order?: number | null
}

export interface SlotOption {
  time: string
  available: boolean
  freeTherapists: number
  totalTherapists: number
  label: string
}

export function formatBookingRef(bookingId: string): string {
  const short = bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()
  return `BK-${short}`
}

export function todaySydneyDateString(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export function formatSydneyDateLabel(dateYmd: string): string {
  return new Date(`${dateYmd}T12:00:00+10:00`).toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  })
}

export function getUpcomingDays(count = 28): string[] {
  const days: string[] = []
  const start = new Date(`${todaySydneyDateString()}T12:00:00+10:00`)
  for (let i = 0; i < count; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    days.push(
      new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Australia/Sydney',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(d)
    )
  }
  return days
}

export function groupServicesByCategory(services: PublicServiceRow[]): Map<string, PublicServiceRow[]> {
  const map = new Map<string, PublicServiceRow[]>()
  for (const svc of services) {
    const cat = (svc.category || 'Services').trim() || 'Services'
    const list = map.get(cat) ?? []
    list.push(svc)
    map.set(cat, list)
  }
  return map
}

export function buildSlotOptions(
  date: string,
  durationMin: number,
  bookings: DayBooking[],
  therapistIds: string[]
): SlotOption[] {
  const today = todaySydneyDateString()
  const nowSydney = new Date(
    new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' })
  )

  return generatePresetSlotTimes().map(time => {
    const { slotStart, slotEnd } = slotWindow(date, time, durationMin)
    if (slotEnd.getHours() > 20 || (slotEnd.getHours() === 20 && slotEnd.getMinutes() > 0)) {
      return {
        time,
        available: false,
        freeTherapists: 0,
        totalTherapists: therapistIds.length,
        label: 'Closed',
      }
    }

    if (date === today) {
      const [h, m] = time.split(':').map(Number)
      const slotLocal = new Date(nowSydney)
      slotLocal.setHours(h, m, 0, 0)
      if (slotLocal <= nowSydney) {
        return {
          time,
          available: false,
          freeTherapists: 0,
          totalTherapists: therapistIds.length,
          label: 'Past',
        }
      }
    }

    const result = evaluateSlotAvailability(bookings, slotStart, slotEnd, therapistIds)
    const free = countFreeTherapists(bookings, therapistIds, slotStart, slotEnd)
    const total = therapistIds.length

    let label = 'Available'
    if (!result.available) label = 'Full'
    else if (total > 0) label = `${free} therapist${free === 1 ? '' : 's'} free`

    return {
      time,
      available: result.available,
      freeTherapists: free,
      totalTherapists: total,
      label,
    }
  })
}

export function pickFirstFreeTherapist(
  bookings: DayBooking[],
  therapistOptions: { id: string; name_en: string }[],
  date: string,
  time: string,
  durationMin: number
): { id: string; name: string } | null {
  const { slotStart, slotEnd } = slotWindow(date, time, durationMin)
  for (const t of therapistOptions) {
    const result = evaluateSlotAvailability(bookings, slotStart, slotEnd, [t.id], t.id)
    if (result.available) return { id: t.id, name: t.name_en }
  }
  return null
}

export function normalizeAuPhone(input: string): string | null {
  const digits = input.replace(/\D/g, '')
  if (/^04\d{8}$/.test(digits)) return digits
  if (/^614\d{8}$/.test(digits)) return `0${digits.slice(2)}`
  if (digits.length >= 9) return digits
  return null
}

export function validateAuPhone(input: string): boolean {
  return normalizeAuPhone(input) !== null
}

export function buildCancelUrl(shopSlug: string, bookingId: string): string {
  const origin = getPublicAppOrigin()
  const params = new URLSearchParams({ booking: bookingId, shop: shopSlug })
  return `${origin}/cancel?${params.toString()}`
}

export function buildGoogleCalendarUrl(opts: {
  title: string
  startIso: string
  endIso: string
  location?: string
  details?: string
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: opts.title,
    dates: `${fmt(opts.startIso)}/${fmt(opts.endIso)}`,
  })
  if (opts.location) params.set('location', opts.location)
  if (opts.details) params.set('details', opts.details)
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export function filterAvailableTimes(
  date: string,
  durationMin: number,
  bookings: DayBooking[],
  therapistIds: string[]
): string[] {
  return filterAvailableSlots(date, durationMin, bookings, therapistIds)
}

export { dayBoundsSydney, slotWindow }
