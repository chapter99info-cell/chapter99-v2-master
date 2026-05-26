import type { Tour, TourBooking } from '../types/tour'
import type { StaffPortalStore } from '../types/staffPortal'

/** Trip2Talk V4 — NZ + Sydney only; Gold Coast / GC trips are excluded. */
export function isGoldCoastDestination(dest: string | null | undefined): boolean {
  const d = (dest ?? '').trim()
  if (!d) return false
  if (/gold\s*coast/i.test(d)) return true
  if (/^GC[-_]/i.test(d) || d.toUpperCase().startsWith('GC')) return true
  return false
}

export function isGoldCoastTour(tour: {
  trip_code?: string | null
  destination?: string | null
  name?: string | null
}): boolean {
  const code = (tour.trip_code ?? '').trim().toUpperCase()
  const dest = (tour.destination ?? '').trim().toUpperCase()
  const name = (tour.name ?? '').trim().toUpperCase()

  if (dest.includes('GOLD COAST')) return true
  if (name.includes('GOLD COAST')) return true
  if (code.startsWith('GC-') || code.startsWith('GC_')) return true
  if (/^GC[-_]/.test(code)) return true
  return false
}

export function filterAllowedTours<T extends { trip_code?: string; destination?: string }>(
  tours: T[]
): T[] {
  return tours.filter((t) => !isGoldCoastTour(t))
}

export function filterBookingsForAllowedTours<T extends TourBooking>(
  bookings: T[],
  tours: Pick<Tour, 'id' | 'trip_code' | 'destination'>[]
): T[] {
  const gcIds = new Set(tours.filter(isGoldCoastTour).map((t) => t.id))
  return bookings.filter((b) => !gcIds.has(b.tour_id))
}

export function purgeGoldCoastFromStaffStore(
  store: StaffPortalStore,
  allTours: Pick<Tour, 'id' | 'trip_code' | 'destination'>[]
): StaffPortalStore {
  const gcIds = new Set(allTours.filter(isGoldCoastTour).map((t) => t.id))
  if (gcIds.size === 0 && !store.bookings.length) return store

  const selectedTourId =
    store.selectedTourId && gcIds.has(store.selectedTourId) ? null : store.selectedTourId

  return {
    ...store,
    selectedTourId,
    bookings: store.bookings.filter((b) => !gcIds.has(b.tourId)),
    guests: store.guests.filter((g) => !gcIds.has(g.tourId)),
    consents: store.consents.filter((c) => !gcIds.has(c.tourId)),
  }
}
