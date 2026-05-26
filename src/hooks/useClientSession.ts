import { useCallback, useEffect, useState } from 'react'
import { fetchPublicTours } from '../lib/publicTours'
import { isGoldCoastTour } from '../lib/tripFilters'
import { supabase } from '../lib/supabase'
import type { CRMClient, Tour, TourBooking, TourDestination } from '../types/tour'

const CLIENT_KEY = 't2_client_id'

export function getStoredClientId(): string | null {
  return localStorage.getItem(CLIENT_KEY)
}

export function setStoredClientId(id: string): void {
  localStorage.setItem(CLIENT_KEY, id)
}

function normalizeDestination(dest: string | null | undefined): TourDestination | null {
  if (!dest) return null
  if (isGoldCoastTour({ destination: dest })) return null
  if (dest === 'New Zealand' || dest === 'Sydney') return dest
  if (/sydney/i.test(dest)) return 'Sydney'
  if (/new\s*zealand|^nz$/i.test(dest)) return 'New Zealand'
  return null
}

export function useClientSession() {
  const [clientId, setClientId] = useState<string | null>(() => getStoredClientId())
  const [client, setClient] = useState<CRMClient | null>(null)
  const [booking, setBooking] = useState<TourBooking | null>(null)
  const [tour, setTour] = useState<Tour | null>(null)
  const [destination, setDestination] = useState<TourDestination | null>(null)
  const [publicTours, setPublicTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const id = getStoredClientId()
    setClientId(id)
    setLoading(true)

    const allowedTours = await fetchPublicTours()
    setPublicTours(allowedTours)

    if (!id) {
      setClient(null)
      setBooking(null)
      setTour(null)
      setDestination(null)
      setLoading(false)
      return
    }
    const { data: c } = await supabase.from('crm_clients').select('*').eq('id', id).maybeSingle()
    setClient((c as CRMClient) ?? null)

    const { data: b } = await supabase
      .from('tour_bookings')
      .select('*, tours(*)')
      .eq('client_id', id)
      .eq('booking_status', 'FULLY_PAID')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (b) {
      const row = b as TourBooking & { tours: Tour | null }
      const bookedTour = row.tours && !isGoldCoastTour(row.tours) ? row.tours : null
      if (bookedTour) {
        setBooking({
          id: row.id,
          tour_id: row.tour_id,
          client_id: row.client_id,
          guide_id: row.guide_id,
          booking_status: row.booking_status,
          amount_paid_aud: row.amount_paid_aud,
        })
        setTour(bookedTour)
        setDestination(normalizeDestination(bookedTour.destination))
      } else {
        setBooking(null)
        setTour(null)
        setDestination(null)
      }
    } else {
      setBooking(null)
      setTour(null)
      setDestination(null)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const displayTour = tour ?? publicTours[0] ?? null
  const displayDestination =
    normalizeDestination(destination ?? displayTour?.destination ?? null) ?? 'New Zealand'

  return {
    clientId,
    client,
    booking,
    tour,
    destination,
    displayTour,
    displayDestination,
    publicTours,
    loading,
    refresh,
    setClientId: (id: string) => {
      setStoredClientId(id)
      void refresh()
    },
  }
}
