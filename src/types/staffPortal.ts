export type StaffPaymentStatus = 'paid' | 'deposit' | 'unpaid'

export type StaffPortalTab = 'bookings' | 'guests' | 'consent' | 'marketing' | 'emergency'

export type ConsentType =
  | 'medical'
  | 'emergency_contact'
  | 'photo_marketing'
  | 'liability'
  | 'privacy'

export const CONSENT_TYPES: { id: ConsentType; label: string }[] = [
  { id: 'medical', label: 'Medical Info Consent' },
  { id: 'emergency_contact', label: 'Emergency Contact Consent' },
  { id: 'photo_marketing', label: 'Photo / Marketing Consent' },
  { id: 'liability', label: 'Liability Waiver' },
  { id: 'privacy', label: 'Privacy Policy' },
]

export interface StaffPortalBooking {
  id: string
  tourId: string
  guestName: string
  phone: string
  email: string
  bookingDate: string
  paxCount: number
  priceAud: number
  paymentStatus: StaffPaymentStatus
  createdAt: string
  updatedAt: string
}

export interface StaffPortalGuest {
  id: string
  tourId: string
  bookingId: string | null
  name: string
  nationality: string
  passportNumber: string
  emergencyContactName: string
  emergencyContactPhone: string
  medicalConditions: string
  bloodType: string
  insuranceProvider: string
  insurancePolicyNumber: string
  dietaryRequirements: string
  mobilityNeeds: string
  lastKnownLat: number | null
  lastKnownLng: number | null
  locationUpdatedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface GuestConsentEntry {
  guestId: string
  tourId: string
  type: ConsentType
  signed: boolean
  signatureDataUrl: string | null
  signedAt: string | null
}

export interface StaffPortalStore {
  version: 1
  selectedTourId: string | null
  bookings: StaffPortalBooking[]
  guests: StaffPortalGuest[]
  consents: GuestConsentEntry[]
  lastKpiSyncAt: string | null
}
