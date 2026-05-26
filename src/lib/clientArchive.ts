import { supabase } from './supabase'
import type { ArchiveReason, ClientArchiveRecord } from '../types/archive'
import type { CRMClient, Tour, TourBooking } from '../types/tour'
import { syncClientArchiveToGoogleSheets } from './googleSync'

export async function fetchClientRecords(
  clientId: string,
  tourId: string
): Promise<ClientArchiveRecord | null> {
  const { data: client, error: cErr } = await supabase
    .from('crm_clients')
    .select('*')
    .eq('id', clientId)
    .single()

  if (cErr || !client) return null

  const { data: tour, error: tErr } = await supabase.from('tours').select('*').eq('id', tourId).single()
  if (tErr || !tour) return null

  const { data: booking, error: bErr } = await supabase
    .from('tour_bookings')
    .select('*')
    .eq('client_id', clientId)
    .eq('tour_id', tourId)
    .maybeSingle()

  if (bErr || !booking) return null

  return {
    client: client as CRMClient,
    tour: tour as Tour,
    booking: {
      id: booking.id,
      tour_id: booking.tour_id,
      client_id: booking.client_id,
      guide_id: booking.guide_id,
      booking_status: booking.booking_status,
      amount_paid_aud: booking.amount_paid_aud,
    },
    archived_at: new Date().toISOString(),
    archived_by_staff_id: '',
    reason: 'TRIP_COMPLETED',
  }
}

export async function hardDeleteClientFromSupabase(clientId: string): Promise<void> {
  await supabase.from('gallery_likes').delete().eq('client_id', clientId)
  await supabase.from('waivers').delete().eq('client_id', clientId)
  await supabase.from('tour_bookings').delete().eq('client_id', clientId)
  await supabase.from('reviews').delete().eq('client_id', clientId)
  const { error } = await supabase.from('crm_clients').delete().eq('id', clientId)
  if (error) throw new Error(error.message)
}

export async function archiveAndDeleteClient(
  clientId: string,
  tourId: string,
  staffId: string,
  reason: ArchiveReason,
  onStage?: (stage: 'fetch' | 'archive' | 'delete') => void
): Promise<void> {
  onStage?.('fetch')
  const record = await fetchClientRecords(clientId, tourId)
  if (!record) throw new Error('Client or booking not found')

  record.archived_by_staff_id = staffId
  record.reason = reason

  onStage?.('archive')
  const sync = await syncClientArchiveToGoogleSheets(record)
  if (!sync.success) {
    console.warn('[Trip2Talk] Continuing delete after archive sync failure:', sync.error)
  }

  onStage?.('delete')
  await hardDeleteClientFromSupabase(clientId)
}
