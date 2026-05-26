import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  filterAllowedTours,
  filterBookingsForAllowedTours,
  purgeGoldCoastFromStaffStore,
} from '../lib/tripFilters'
import {
  readStaffPortalStore,
  syncStaffBookingsToOwnerKpi,
  writeStaffPortalStore,
} from '../lib/staffPortalStorage'
import type { StaffPortalStore } from '../types/staffPortal'
import type { Tour, TourBookingWithClient } from '../types/tour'

export function useStaffPortal() {
  const [store, setStore] = useState<StaffPortalStore>(() => readStaffPortalStore())
  const [tours, setTours] = useState<Tour[]>([])
  const [supabaseBookings, setSupabaseBookings] = useState<TourBookingWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const selectedTourId = store.selectedTourId ?? ''
  const selectedTour = useMemo(
    () => tours.find((t) => t.id === selectedTourId) ?? null,
    [tours, selectedTourId]
  )

  const persist = useCallback((next: StaffPortalStore) => {
    writeStaffPortalStore(next)
    syncStaffBookingsToOwnerKpi(next.bookings)
    setStore(next)
  }, [])

  const setSelectedTourId = useCallback(
    (tourId: string) => {
      const next = { ...readStaffPortalStore(), selectedTourId: tourId || null }
      persist(next)
    },
    [persist]
  )

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [toursRes, bookingsRes] = await Promise.all([
        supabase.from('tours').select('*').order('start_date', { ascending: false }),
        supabase.from('tour_bookings').select('*, crm_clients(*)'),
      ])
      if (toursRes.error) throw new Error(toursRes.error.message)
      if (bookingsRes.error) throw new Error(bookingsRes.error.message)
      const allTours = (toursRes.data ?? []) as Tour[]
      const list = filterAllowedTours(allTours)
      const bookings = filterBookingsForAllowedTours(
        (bookingsRes.data ?? []) as TourBookingWithClient[],
        allTours
      )
      setTours(list)
      setSupabaseBookings(bookings)
      const purged = purgeGoldCoastFromStaffStore(readStaffPortalStore(), allTours)
      const selectedOk =
        purged.selectedTourId && list.some((t) => t.id === purged.selectedTourId)
      persist({
        ...purged,
        selectedTourId: selectedOk ? purged.selectedTourId : list[0]?.id ?? null,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
      setStore(readStaffPortalStore())
    } finally {
      setLoading(false)
    }
  }, [persist])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const supabaseForTour = useMemo(
    () => supabaseBookings.filter((b) => b.tour_id === selectedTourId),
    [supabaseBookings, selectedTourId]
  )

  return {
    store,
    setStore: persist,
    tours,
    selectedTourId,
    selectedTour,
    setSelectedTourId,
    supabaseForTour,
    supabaseBookings,
    loading,
    error,
    refresh,
  }
}
