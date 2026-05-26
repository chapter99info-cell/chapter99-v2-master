import { useState } from 'react'
import {
  buildGpsShareLink,
  captureGuestLocation,
  guestsForTour,
  upsertGuest,
} from '../../lib/staffPortalStorage'
import type { StaffPortalGuest, StaffPortalStore } from '../../types/staffPortal'
import type { Tour } from '../../types/tour'
import StaffEmergencyOverlay from './StaffEmergencyOverlay'

export default function StaffGuestsTab({
  store,
  setStore,
  selectedTour,
  selectedTourId,
  setSelectedTourId,
  tours,
}: {
  store: StaffPortalStore
  setStore: (s: StaffPortalStore) => void
  selectedTour: Tour | null
  selectedTourId: string
  setSelectedTourId: (id: string) => void
  tours: Tour[]
}) {
  const [emergencyGuest, setEmergencyGuest] = useState<StaffPortalGuest | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [gpsMsg, setGpsMsg] = useState<string | null>(null)

  const guests = selectedTourId ? guestsForTour(store, selectedTourId) : []

  const saveGuest = (guest: StaffPortalGuest) => {
    setStore(upsertGuest(store, guest))
    setEditingId(null)
  }

  const shareGps = async (guest: StaffPortalGuest) => {
    setGpsMsg(null)
    try {
      const updated = await captureGuestLocation(guest)
      setStore(upsertGuest(store, updated))
      const link = buildGpsShareLink(updated)
      if (link) {
        await navigator.clipboard.writeText(link)
        setGpsMsg(`GPS link copied for ${guest.name}`)
      }
    } catch (e) {
      setGpsMsg(e instanceof Error ? e.message : 'GPS failed')
    }
  }

  if (!selectedTourId) {
    return (
      <p className="text-sm text-neutral-500 staff-portal__card">
        Select a trip below — guests are never mixed across tours.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="staff-portal__card">
        <label className="staff-portal__label" htmlFor="guests-tour">
          Active trip (guests filtered)
        </label>
        <select
          id="guests-tour"
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
        {selectedTour && (
          <p className="text-xs text-neutral-500 mt-2">
            Showing {guests.length} guest{guests.length === 1 ? '' : 's'} for {selectedTour.trip_code} only
          </p>
        )}
      </div>

      {gpsMsg && <p className="text-xs text-emerald-400">{gpsMsg}</p>}

      {guests.length === 0 ? (
        <p className="staff-portal__card text-sm text-neutral-500">
          No guests for this trip. Add a booking in the Bookings tab.
        </p>
      ) : (
        guests.map((guest) => (
          <GuestCard
            key={`${guest.id}-${guest.updatedAt}`}
            guest={guest}
            editing={editingId === guest.id}
            onEdit={() => setEditingId(guest.id)}
            onSave={saveGuest}
            onCancel={() => setEditingId(null)}
            onEmergency={() => setEmergencyGuest(guest)}
            onGps={() => void shareGps(guest)}
          />
        ))
      )}

      {emergencyGuest && (
        <StaffEmergencyOverlay
          guest={emergencyGuest}
          onClose={() => setEmergencyGuest(null)}
          onRefreshGps={() => void shareGps(emergencyGuest)}
        />
      )}
    </div>
  )
}

function GuestCard({
  guest,
  editing,
  onEdit,
  onSave,
  onCancel,
  onEmergency,
  onGps,
}: {
  guest: StaffPortalGuest
  editing: boolean
  onEdit: () => void
  onSave: (g: StaffPortalGuest) => void
  onCancel: () => void
  onEmergency: () => void
  onGps: () => void
}) {
  const [draft, setDraft] = useState(guest)

  if (editing) {
    const field = (key: keyof StaffPortalGuest, label: string) => (
      <div>
        <label className="staff-portal__label">{label}</label>
        <input
          className="staff-portal__input"
          value={String(draft[key] ?? '')}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
        />
      </div>
    )
    return (
      <div className="staff-portal__guest-card space-y-2">
        {field('name', 'Name')}
        {field('nationality', 'Nationality')}
        {field('passportNumber', 'Passport')}
        {field('emergencyContactName', 'Emergency contact name')}
        {field('emergencyContactPhone', 'Emergency phone')}
        {field('medicalConditions', 'Medical / allergies')}
        {field('bloodType', 'Blood type')}
        {field('insuranceProvider', 'Insurance provider')}
        {field('insurancePolicyNumber', 'Policy number')}
        {field('dietaryRequirements', 'Dietary')}
        {field('mobilityNeeds', 'Mobility / special needs')}
        <div className="flex gap-2">
          <button type="button" className="staff-portal__btn-gold flex-1" onClick={() => onSave(draft)}>
            Save
          </button>
          <button type="button" className="staff-portal__btn-ghost flex-1" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="staff-portal__guest-card">
      <p className="font-semibold text-lg">{guest.name}</p>
      <p className="text-xs text-neutral-500 mt-0.5">
        {guest.nationality || '—'} · Passport {guest.passportNumber || '—'}
      </p>
      <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-neutral-600">Emergency</dt>
          <dd>
            {guest.emergencyContactName || '—'}
            <br />
            {guest.emergencyContactPhone || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-600">Medical</dt>
          <dd>{guest.medicalConditions || '—'}</dd>
        </div>
        <div>
          <dt className="text-neutral-600">Blood type</dt>
          <dd>{guest.bloodType || '—'}</dd>
        </div>
        <div>
          <dt className="text-neutral-600">Insurance</dt>
          <dd>
            {guest.insuranceProvider || '—'}
            <br />
            {guest.insurancePolicyNumber || ''}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-600">Dietary</dt>
          <dd>{guest.dietaryRequirements || '—'}</dd>
        </div>
        <div>
          <dt className="text-neutral-600">Mobility</dt>
          <dd>{guest.mobilityNeeds || '—'}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2 mt-4">
        <button type="button" className="staff-portal__btn-red" onClick={onEmergency}>
          EMERGENCY
        </button>
        <button type="button" className="staff-portal__btn-ghost" onClick={onGps}>
          GPS Share
        </button>
        {guest.emergencyContactPhone && (
          <a
            href={`tel:${guest.emergencyContactPhone.replace(/\s/g, '')}`}
            className="staff-portal__btn-ghost"
          >
            SOS Call
          </a>
        )}
        <button type="button" className="staff-portal__btn-ghost opacity-60" disabled>
          SMS
          <span className="staff-portal__v5-badge">Coming V5</span>
        </button>
        <button type="button" className="staff-portal__btn-ghost ml-auto" onClick={onEdit}>
          Edit
        </button>
      </div>
    </div>
  )
}
