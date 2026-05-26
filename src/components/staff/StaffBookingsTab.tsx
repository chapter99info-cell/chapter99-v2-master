import { FormEvent, useMemo, useState } from 'react'
import { bookingsForTour, upsertBooking } from '../../lib/staffPortalStorage'
import type { StaffPaymentStatus, StaffPortalBooking, StaffPortalStore } from '../../types/staffPortal'
import type { Tour, TourBookingWithClient } from '../../types/tour'

function formatTourDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Australia/Sydney',
    })
  } catch {
    return iso
  }
}

function paymentLabel(s: StaffPaymentStatus): string {
  if (s === 'paid') return 'Paid'
  if (s === 'deposit') return 'Deposit'
  return 'Unpaid'
}

export default function StaffBookingsTab({
  store,
  setStore,
  tours,
  selectedTourId,
  setSelectedTourId,
  allSupabaseBookings,
  onOpenTripGuests,
}: {
  store: StaffPortalStore
  setStore: (s: StaffPortalStore) => void
  tours: Tour[]
  selectedTourId: string
  setSelectedTourId: (id: string) => void
  allSupabaseBookings: TourBookingWithClient[]
  onOpenTripGuests: (tourId: string) => void
}) {
  const [expandedTourId, setExpandedTourId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [tourId, setTourId] = useState(selectedTourId)
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [paxCount, setPaxCount] = useState('1')
  const [priceAud, setPriceAud] = useState('')
  const [paymentStatus, setPaymentStatus] = useState<StaffPaymentStatus>('deposit')

  const grouped = useMemo(() => {
    return tours.map((tour) => {
      const local = bookingsForTour(store, tour.id)
      const remoteCount = allSupabaseBookings.filter((b) => b.tour_id === tour.id).length
      const pax = local.reduce((s, b) => s + b.paxCount, 0) + remoteCount
      return { tour, local, remoteCount, pax }
    })
  }, [tours, store, allSupabaseBookings])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!tourId || !guestName.trim()) return
    const now = new Date().toISOString()
    const booking: StaffPortalBooking = {
      id: crypto.randomUUID(),
      tourId,
      guestName: guestName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      bookingDate,
      paxCount: Math.max(1, parseInt(paxCount, 10) || 1),
      priceAud: parseFloat(priceAud) || 0,
      paymentStatus,
      createdAt: now,
      updatedAt: now,
    }
    const next = upsertBooking(store, booking)
    setStore(next)
    setSelectedTourId(tourId)
    setShowForm(false)
    setGuestName('')
    setPhone('')
    setEmail('')
    setPaxCount('1')
    setPriceAud('')
  }

  const expandedLocal = expandedTourId ? bookingsForTour(store, expandedTourId) : []

  return (
    <div className="space-y-4">
      <div className="staff-portal__card flex flex-wrap justify-between gap-2 items-center">
        <div>
          <h2 className="text-sm font-bold" style={{ color: '#F59E0B' }}>
            Bookings by trip
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">Saved offline · synced to Owner KPI</p>
        </div>
        <button type="button" className="staff-portal__btn-gold" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Cancel' : '+ New booking'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="staff-portal__card space-y-3">
          <div>
            <label className="staff-portal__label">Guest name</label>
            <input className="staff-portal__input" value={guestName} onChange={(e) => setGuestName(e.target.value)} required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="staff-portal__label">Phone</label>
              <input className="staff-portal__input" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <label className="staff-portal__label">Email</label>
              <input type="email" className="staff-portal__input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="staff-portal__label">Tour</label>
            <select className="staff-portal__select" value={tourId} onChange={(e) => setTourId(e.target.value)} required>
              <option value="">Select tour…</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trip_code} — {t.destination}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="staff-portal__label">Date</label>
              <input type="date" className="staff-portal__input" value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} />
            </div>
            <div>
              <label className="staff-portal__label">Pax</label>
              <input type="number" min={1} className="staff-portal__input" value={paxCount} onChange={(e) => setPaxCount(e.target.value)} />
            </div>
            <div>
              <label className="staff-portal__label">Price (AUD)</label>
              <input type="number" min={0} step="0.01" className="staff-portal__input" value={priceAud} onChange={(e) => setPriceAud(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="staff-portal__label">Payment status</label>
            <select
              className="staff-portal__select"
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value as StaffPaymentStatus)}
            >
              <option value="paid">Paid</option>
              <option value="deposit">Deposit</option>
              <option value="unpaid">Unpaid</option>
            </select>
          </div>
          <button type="submit" className="staff-portal__btn-gold w-full">
            Save booking
          </button>
        </form>
      )}

      {grouped.map(({ tour, local, pax }) => (
        <div key={tour.id} className="staff-portal__card">
          <button
            type="button"
            className={`staff-portal__trip-row ${expandedTourId === tour.id ? 'staff-portal__trip-row--on' : ''}`}
            onClick={() => setExpandedTourId((id) => (id === tour.id ? null : tour.id))}
          >
            <p className="font-semibold text-[#f5f5f5]">
              {tour.trip_code} · {tour.destination}
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              {formatTourDate(tour.start_date)} · {pax} pax · {tour.status}
            </p>
            <p className="text-[10px] mt-1" style={{ color: '#F59E0B' }}>
              {local.length} staff booking{local.length === 1 ? '' : 's'} · tap for guest list
            </p>
          </button>
          {expandedTourId === tour.id && (
            <div className="mt-3 border-t border-neutral-800 pt-3">
              <div className="flex flex-wrap gap-2 mb-3">
                <button
                  type="button"
                  className="staff-portal__btn-ghost"
                  onClick={() => {
                    setSelectedTourId(tour.id)
                    onOpenTripGuests(tour.id)
                  }}
                >
                  View guests
                </button>
              </div>
              {expandedLocal.length === 0 ? (
                <p className="text-sm text-neutral-500">No staff portal bookings for this trip yet.</p>
              ) : (
                <ul className="space-y-2">
                  {expandedLocal.map((b) => (
                    <li key={b.id} className="text-sm border border-neutral-800 rounded-lg p-2">
                      <p className="font-medium">{b.guestName}</p>
                      <p className="text-xs text-neutral-500">
                        {b.paxCount} pax · ${b.priceAud.toFixed(2)} · {paymentLabel(b.paymentStatus)}
                      </p>
                      <p className="text-[10px] text-neutral-600">{b.phone} · {b.email}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
