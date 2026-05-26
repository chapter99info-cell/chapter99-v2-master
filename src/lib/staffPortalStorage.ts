import { isGoldCoastTour } from './tripFilters'
import type { BookingStatus, TourBooking } from '../types/tour'
import type {
  ConsentType,
  GuestConsentEntry,
  StaffPaymentStatus,
  StaffPortalBooking,
  StaffPortalGuest,
  StaffPortalStore,
} from '../types/staffPortal'

export const STAFF_PORTAL_STORAGE_KEY = 't2t_staff_portal_v1'
export const STAFF_PORTAL_KPI_KEY = 't2t_staff_portal_kpi_bookings'

function emptyStore(): StaffPortalStore {
  return {
    version: 1,
    selectedTourId: null,
    bookings: [],
    guests: [],
    consents: [],
    lastKpiSyncAt: null,
  }
}

export function readStaffPortalStore(): StaffPortalStore {
  try {
    const raw = localStorage.getItem(STAFF_PORTAL_STORAGE_KEY)
    if (!raw) return emptyStore()
    const parsed = JSON.parse(raw) as StaffPortalStore
    return {
      version: 1,
      selectedTourId: parsed.selectedTourId ?? null,
      bookings: Array.isArray(parsed.bookings) ? parsed.bookings : [],
      guests: Array.isArray(parsed.guests) ? parsed.guests : [],
      consents: Array.isArray(parsed.consents) ? parsed.consents : [],
      lastKpiSyncAt: parsed.lastKpiSyncAt ?? null,
    }
  } catch {
    return emptyStore()
  }
}

export function writeStaffPortalStore(store: StaffPortalStore): void {
  localStorage.setItem(STAFF_PORTAL_STORAGE_KEY, JSON.stringify(store))
}

export function paymentStatusToBookingStatus(status: StaffPaymentStatus): BookingStatus {
  if (status === 'paid') return 'FULLY_PAID'
  if (status === 'deposit') return 'DEPOSIT_PAID'
  return 'PENDING'
}

export function staffBookingsToTourBookings(bookings: StaffPortalBooking[]): TourBooking[] {
  const now = new Date().toISOString()
  return bookings.map((b) => ({
    id: `staff_${b.id}`,
    tour_id: b.tourId,
    client_id: `staff_guest_${b.id}`,
    guide_id: null,
    booking_status: paymentStatusToBookingStatus(b.paymentStatus),
    amount_paid_aud:
      b.paymentStatus === 'unpaid' ? 0 : b.paymentStatus === 'deposit' ? b.priceAud * 0.3 : b.priceAud,
    is_checked_in: false,
    booked_at: b.bookingDate,
    payment_method: 'STAFF_PORTAL',
    created_at: b.createdAt || now,
  }))
}

export function syncStaffBookingsToOwnerKpi(
  bookings: StaffPortalBooking[],
  tours: { id: string; trip_code: string; destination: string }[] = []
): void {
  const gcIds = new Set(tours.filter(isGoldCoastTour).map((t) => t.id))
  const filtered = bookings.filter((b) => !gcIds.has(b.tourId))
  const payload = staffBookingsToTourBookings(filtered)
  localStorage.setItem(STAFF_PORTAL_KPI_KEY, JSON.stringify(payload))
  const store = readStaffPortalStore()
  store.lastKpiSyncAt = new Date().toISOString()
  writeStaffPortalStore(store)
}

export function readStaffKpiBookings(): TourBooking[] {
  try {
    const raw = localStorage.getItem(STAFF_PORTAL_KPI_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TourBooking[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function mergeBookingsForOwner(remote: TourBooking[]): TourBooking[] {
  const local = readStaffKpiBookings()
  const ids = new Set(remote.map((b) => b.id))
  const merged = [...remote]
  for (const b of local) {
    if (!ids.has(b.id)) merged.push(b)
  }
  return merged
}

export function upsertBooking(
  store: StaffPortalStore,
  booking: StaffPortalBooking,
  guest?: Partial<StaffPortalGuest>
): StaffPortalStore {
  const bookings = store.bookings.filter((b) => b.id !== booking.id)
  bookings.unshift(booking)

  let guests = [...store.guests]
  if (guest) {
    const existing = guests.find((g) => g.bookingId === booking.id)
    const guestRow: StaffPortalGuest = {
      id: existing?.id ?? crypto.randomUUID(),
      tourId: booking.tourId,
      bookingId: booking.id,
      name: guest.name ?? booking.guestName,
      nationality: guest.nationality ?? existing?.nationality ?? '',
      passportNumber: guest.passportNumber ?? existing?.passportNumber ?? '',
      emergencyContactName: guest.emergencyContactName ?? existing?.emergencyContactName ?? '',
      emergencyContactPhone: guest.emergencyContactPhone ?? existing?.emergencyContactPhone ?? '',
      medicalConditions: guest.medicalConditions ?? existing?.medicalConditions ?? '',
      bloodType: guest.bloodType ?? existing?.bloodType ?? '',
      insuranceProvider: guest.insuranceProvider ?? existing?.insuranceProvider ?? '',
      insurancePolicyNumber: guest.insurancePolicyNumber ?? existing?.insurancePolicyNumber ?? '',
      dietaryRequirements: guest.dietaryRequirements ?? existing?.dietaryRequirements ?? '',
      mobilityNeeds: guest.mobilityNeeds ?? existing?.mobilityNeeds ?? '',
      lastKnownLat: existing?.lastKnownLat ?? null,
      lastKnownLng: existing?.lastKnownLng ?? null,
      locationUpdatedAt: existing?.locationUpdatedAt ?? null,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    guests = guests.filter((g) => g.id !== guestRow.id)
    guests.unshift(guestRow)
  }

  const next = { ...store, bookings, guests }
  writeStaffPortalStore(next)
  syncStaffBookingsToOwnerKpi(bookings)
  return next
}

export function upsertGuest(store: StaffPortalStore, guest: StaffPortalGuest): StaffPortalStore {
  const guests = store.guests.filter((g) => g.id !== guest.id)
  guests.unshift({ ...guest, updatedAt: new Date().toISOString() })
  const next = { ...store, guests }
  writeStaffPortalStore(next)
  return next
}

export function consentKey(guestId: string, tourId: string, type: ConsentType): string {
  return `${tourId}::${guestId}::${type}`
}

export function getConsent(
  store: StaffPortalStore,
  guestId: string,
  tourId: string,
  type: ConsentType
): GuestConsentEntry {
  const found = store.consents.find(
    (c) => c.guestId === guestId && c.tourId === tourId && c.type === type
  )
  return (
    found ?? {
      guestId,
      tourId,
      type,
      signed: false,
      signatureDataUrl: null,
      signedAt: null,
    }
  )
}

export function setConsent(
  store: StaffPortalStore,
  entry: GuestConsentEntry
): StaffPortalStore {
  const key = consentKey(entry.guestId, entry.tourId, entry.type)
  const consents = store.consents.filter(
    (c) => consentKey(c.guestId, c.tourId, c.type) !== key
  )
  consents.push(entry)
  const next = { ...store, consents }
  writeStaffPortalStore(next)
  return next
}

export function guestsForTour(store: StaffPortalStore, tourId: string): StaffPortalGuest[] {
  return store.guests.filter((g) => g.tourId === tourId)
}

export function bookingsForTour(store: StaffPortalStore, tourId: string): StaffPortalBooking[] {
  return store.bookings.filter((b) => b.tourId === tourId)
}

export function buildGpsShareLink(guest: StaffPortalGuest): string | null {
  if (guest.lastKnownLat == null || guest.lastKnownLng == null) return null
  return `https://maps.google.com/?q=${guest.lastKnownLat},${guest.lastKnownLng}`
}

export async function captureGuestLocation(guest: StaffPortalGuest): Promise<StaffPortalGuest> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          ...guest,
          lastKnownLat: pos.coords.latitude,
          lastKnownLng: pos.coords.longitude,
          locationUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      },
      (err) => reject(new Error(err.message)),
      { enableHighAccuracy: true, timeout: 12_000 }
    )
  })
}
