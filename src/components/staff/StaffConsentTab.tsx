import { useMemo, useState } from 'react'
import { CONSENT_TYPES, type ConsentType, type StaffPortalGuest, type StaffPortalStore } from '../../types/staffPortal'
import { getConsent, guestsForTour, setConsent } from '../../lib/staffPortalStorage'
import SignaturePad from './SignaturePad'

function consentShareLink(guest: StaffPortalGuest, tourCode: string, type: ConsentType): string {
  const base = typeof window !== 'undefined' ? window.location.origin : 'https://www.trip2talk.com.au'
  return `${base}/onboard?guest=${encodeURIComponent(guest.id)}&trip=${encodeURIComponent(tourCode)}&consent=${type}`
}

export default function StaffConsentTab({
  store,
  setStore,
  selectedTourId,
  setSelectedTourId,
  tours,
  tripCode,
}: {
  store: StaffPortalStore
  setStore: (s: StaffPortalStore) => void
  selectedTourId: string
  setSelectedTourId: (id: string) => void
  tours: { id: string; trip_code: string; destination: string }[]
  tripCode: string
}) {
  const [activeGuestId, setActiveGuestId] = useState<string | null>(null)
  const [activeType, setActiveType] = useState<ConsentType | null>(null)
  const [signature, setSignature] = useState<string | null>(null)
  const [sendMsg, setSendMsg] = useState<string | null>(null)

  const guests = selectedTourId ? guestsForTour(store, selectedTourId) : []
  const activeGuest = guests.find((g) => g.id === activeGuestId) ?? null

  const summary = useMemo(() => {
    return guests.map((g) => {
      const signed = CONSENT_TYPES.filter((t) => getConsent(store, g.id, selectedTourId, t.id).signed).length
      return { guest: g, signed, total: CONSENT_TYPES.length }
    })
  }, [guests, store, selectedTourId])

  const signConsent = () => {
    if (!activeGuest || !activeType || !signature) return
    const entry = {
      guestId: activeGuest.id,
      tourId: selectedTourId,
      type: activeType,
      signed: true,
      signatureDataUrl: signature,
      signedAt: new Date().toISOString(),
    }
    setStore(setConsent(store, entry))
    setSignature(null)
    setActiveType(null)
  }

  const exportPdf = (guest: StaffPortalGuest) => {
    const lines = CONSENT_TYPES.map((t) => {
      const c = getConsent(store, guest.id, selectedTourId, t.id)
      return `${t.label}: ${c.signed ? `Signed ${c.signedAt}` : 'Pending'}`
    })
    const html = `<!DOCTYPE html><html><body style="font-family:sans-serif;padding:24px">
      <h1>Trip2Talk Consents</h1>
      <p><strong>${guest.name}</strong> · ${tripCode}</p>
      <ul>${lines.map((l) => `<li>${l}</li>`).join('')}</ul>
    </body></html>`
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(html)
    w.document.close()
    w.print()
  }

  const bookingForGuest = (guest: StaffPortalGuest) =>
    store.bookings.find((b) => b.id === guest.bookingId && b.tourId === selectedTourId)

  const sendLink = async (guest: StaffPortalGuest, channel: 'email' | 'phone') => {
    const type = activeType ?? 'liability'
    const link = consentShareLink(guest, tripCode, type)
    const body = `Trip2Talk consent form for ${guest.name}: ${link}`
    const booking = bookingForGuest(guest)
    if (channel === 'email' && booking?.email) {
      window.location.href = `mailto:${booking.email}?subject=${encodeURIComponent('Trip2Talk consent')}&body=${encodeURIComponent(body)}`
      setSendMsg('Email client opened')
      return
    }
    if (channel === 'phone' && booking?.phone) {
      await navigator.clipboard.writeText(`${body}\n\nSMS to: ${booking.phone}`)
      setSendMsg('Link copied — SMS sending in V5')
      return
    }
    await navigator.clipboard.writeText(body)
    setSendMsg('Consent link copied to clipboard')
  }

  return (
    <div className="space-y-4">
      <div className="staff-portal__card">
        <label className="staff-portal__label">Trip</label>
        <select
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
      </div>

      {sendMsg && <p className="text-xs text-emerald-400">{sendMsg}</p>}

      {summary.map(({ guest, signed, total }) => (
        <div key={guest.id} className="staff-portal__card">
          <div className="flex flex-wrap justify-between gap-2 mb-2">
            <p className="font-semibold">{guest.name}</p>
            <span className={signed === total ? 'staff-portal__badge-ok' : 'staff-portal__badge-pending'}>
              {signed === total ? '✅ All signed' : `⚠️ ${signed}/${total}`}
            </span>
          </div>
          <ul className="space-y-2 mb-3">
            {CONSENT_TYPES.map((t) => {
              const c = getConsent(store, guest.id, selectedTourId, t.id)
              return (
                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span>{t.label}</span>
                  <span className={c.signed ? 'staff-portal__badge-ok' : 'staff-portal__badge-pending'}>
                    {c.signed ? '✅ Signed' : '⚠️ Pending'}
                  </span>
                  <button
                    type="button"
                    className="staff-portal__btn-ghost"
                    onClick={() => {
                      setActiveGuestId(guest.id)
                      setActiveType(t.id)
                    }}
                  >
                    Sign
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="staff-portal__btn-ghost" onClick={() => void exportPdf(guest)}>
              PDF export
            </button>
            <button type="button" className="staff-portal__btn-ghost" onClick={() => void sendLink(guest, 'email')}>
              Send email
            </button>
            <button type="button" className="staff-portal__btn-ghost" onClick={() => void sendLink(guest, 'phone')}>
              Send link
            </button>
          </div>
        </div>
      ))}

      {activeGuest && activeType && (
        <div className="staff-portal__card">
          <p className="text-sm font-semibold mb-2" style={{ color: '#F59E0B' }}>
            Sign: {CONSENT_TYPES.find((t) => t.id === activeType)?.label} — {activeGuest.name}
          </p>
          <SignaturePad onChange={setSignature} />
          <button
            type="button"
            className="staff-portal__btn-gold w-full mt-3"
            disabled={!signature}
            onClick={signConsent}
          >
            Confirm signature
          </button>
        </div>
      )}
    </div>
  )
}
