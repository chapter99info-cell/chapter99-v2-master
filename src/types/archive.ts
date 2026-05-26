import type { CRMClient, Tour, TourBooking } from './tour'

export type ArchiveReason = 'TRIP_COMPLETED' | 'CANCELLED' | 'COMPLIANCE'

export interface ClientArchiveRecord {
  client: CRMClient
  booking: TourBooking
  tour: Tour
  archived_at: string
  archived_by_staff_id: string
  reason: ArchiveReason
}

export interface ArchiveProgressStep {
  id: 'fetch' | 'archive' | 'delete'
  label: string
  status: 'pending' | 'active' | 'done' | 'error'
}
