import { useState } from 'react'
import { guestsForTour } from '../../lib/staffPortalStorage'
import type { StaffPortalGuest, StaffPortalStore } from '../../types/staffPortal'
import type { Tour } from '../../types/tour'
import StaffEmergencyOverlay from './StaffEmergencyOverlay'

export default function StaffEmergencyTab({
  store,
  tours,
  selectedTourId,
  setSelectedTourId,
}: {
  store: StaffPortalStore
  tours: Tour[]
  selectedTourId: string
  setSelectedTourId: (id: string) => void
}) {
  const [overlayGuest, setOverlayGuest] = useState<StaffPortalGuest | null>(null)

  const guests = selectedTourId ? guestsForTour(store, selectedTourId) : []

  return (
    <div className="space-y-4">
      <div className="staff-portal__card">
        <label className="staff-portal__label" htmlFor="em-tour">
          Active trip
        </label>
        <select
          id="em-tour"
          className="staff-portal__select"
          value={selectedTourId}
          onChange={(e) => setSelectedTourId(e.target.value)}
        >
          {tours.map((t) => (
            <option key={t.id} value={t.id}>
              {t.trip_code} — {t.destination}
            </option>
          ))}
        </select>
        <p className="text-xs text-neutral-500 mt-2">Works offline via localStorage</p>
      </div>

      {guests.length === 0 ? (
        <p className="staff-portal__card text-sm text-neutral-500">No guests on file for this trip.</p>
      ) : (
        <ul className="space-y-2">
          {guests.map((guest) => (
            <li
              key={guest.id}
              className="staff-portal__card flex flex-wrap items-center justify-between gap-2"
            >
              <span className="font-medium">{guest.name}</span>
              <button
                type="button"
                className="staff-portal__btn-red"
                onClick={() => setOverlayGuest(guest)}
              >
                EMERGENCY
              </button>
            </li>
          ))}
        </ul>
      )}

      {overlayGuest && (
        <StaffEmergencyOverlay
          guest={overlayGuest}
          onClose={() => setOverlayGuest(null)}
        />
      )}
    </div>
  )
}
