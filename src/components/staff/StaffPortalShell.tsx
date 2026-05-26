import { useState } from 'react'
import { useStaffPortal } from '../../hooks/useStaffPortal'
import type { StaffPortalTab } from '../../types/staffPortal'
import StaffBookingsTab from './StaffBookingsTab'
import StaffConsentTab from './StaffConsentTab'
import StaffEmergencyTab from './StaffEmergencyTab'
import StaffGuestsTab from './StaffGuestsTab'
import StaffMarketing from './StaffMarketing'
import '../../styles/staff-portal.css'

const TABS: { id: StaffPortalTab; label: string }[] = [
  { id: 'bookings', label: 'BOOKINGS' },
  { id: 'guests', label: 'GUESTS' },
  { id: 'consent', label: 'CONSENT' },
  { id: 'marketing', label: 'MARKETING' },
  { id: 'emergency', label: 'EMERGENCY' },
]

export default function StaffPortalShell({ onLogout }: { onLogout: () => void }) {
  const {
    store,
    setStore,
    tours,
    selectedTourId,
    selectedTour,
    setSelectedTourId,
    supabaseBookings,
    loading,
    error,
    refresh,
  } = useStaffPortal()

  const [tab, setTab] = useState<StaffPortalTab>('bookings')

  const openGuestsForTrip = (tourId: string) => {
    setSelectedTourId(tourId)
    setTab('guests')
  }

  if (loading && !tours.length) {
    return (
      <div className="staff-portal flex items-center justify-center min-h-screen">
        <p style={{ color: '#F59E0B' }} className="animate-pulse">
          Loading staff portal…
        </p>
      </div>
    )
  }

  return (
    <div className="staff-portal">
      <div className="staff-portal__inner">
        <header className="flex flex-wrap justify-between items-start gap-3 mb-4">
          <div>
            <p className="text-[0.65rem] uppercase tracking-[0.2em]" style={{ color: '#F59E0B' }}>
              Trip2Talk · Staff Portal
            </p>
            <h1 className="text-xl md:text-2xl font-bold mt-1" style={{ color: '#F59E0B' }}>
              STAFF
            </h1>
            <p className="text-xs text-neutral-500 mt-1">PIN 1111 · per-trip data only</p>
          </div>
          <button type="button" onClick={onLogout} className="staff-portal__btn-ghost">
            EXIT
          </button>
        </header>

        {error && (
          <div className="staff-portal__card mb-4 flex justify-between gap-2 border-red-500/40">
            <span className="text-red-400 text-sm">{error}</span>
            <button type="button" className="staff-portal__btn-ghost" onClick={() => void refresh()}>
              Retry
            </button>
          </div>
        )}

        <nav className="staff-portal__tabs" aria-label="Staff portal">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`staff-portal__tab ${tab === t.id ? 'staff-portal__tab--on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === 'bookings' && (
          <StaffBookingsTab
            store={store}
            setStore={setStore}
            tours={tours}
            selectedTourId={selectedTourId}
            setSelectedTourId={setSelectedTourId}
            allSupabaseBookings={supabaseBookings}
            onOpenTripGuests={openGuestsForTrip}
          />
        )}

        {tab === 'guests' && (
          <StaffGuestsTab
            store={store}
            setStore={setStore}
            selectedTour={selectedTour}
            selectedTourId={selectedTourId}
            setSelectedTourId={setSelectedTourId}
            tours={tours}
          />
        )}

        {tab === 'consent' && (
          <StaffConsentTab
            store={store}
            setStore={setStore}
            selectedTourId={selectedTourId}
            setSelectedTourId={setSelectedTourId}
            tours={tours}
            tripCode={selectedTour?.trip_code ?? ''}
          />
        )}

        {tab === 'marketing' && <StaffMarketing activeTour={selectedTour} />}

        {tab === 'emergency' && (
          <StaffEmergencyTab
            store={store}
            tours={tours}
            selectedTourId={selectedTourId}
            setSelectedTourId={setSelectedTourId}
          />
        )}

        {store.lastKpiSyncAt && (
          <p className="text-[10px] text-neutral-600 text-center mt-6">
            KPI sync {new Date(store.lastKpiSyncAt).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' })}
          </p>
        )}
      </div>
    </div>
  )
}
