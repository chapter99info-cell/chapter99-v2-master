import type { StaffPortalGuest } from '../../types/staffPortal'
import { buildGpsShareLink } from '../../lib/staffPortalStorage'

export default function StaffEmergencyOverlay({
  guest,
  onClose,
  onRefreshGps,
}: {
  guest: StaffPortalGuest
  onClose: () => void
  onRefreshGps?: () => void
}) {
  const gps = buildGpsShareLink(guest)

  return (
    <div className="staff-portal__emergency-overlay" role="dialog" aria-modal="true">
      <button
        type="button"
        onClick={onClose}
        className="staff-portal__btn-ghost mb-4"
        style={{ color: '#fca5a5', borderColor: '#7f1d1d' }}
      >
        ← Close
      </button>
      <p className="text-xs uppercase tracking-widest text-red-400 mb-1">Emergency profile</p>
      <h2 className="text-2xl font-bold text-red-100 mb-4">{guest.name}</h2>

      <div className="space-y-4 text-sm">
        <section>
          <p className="text-red-400 text-xs uppercase mb-1">Blood type</p>
          <p className="text-xl font-mono">{guest.bloodType || 'Unknown'}</p>
        </section>
        <section>
          <p className="text-red-400 text-xs uppercase mb-1">Medical / allergies</p>
          <p className="text-red-50 whitespace-pre-wrap">
            {guest.medicalConditions || 'None recorded'}
          </p>
        </section>
        <section>
          <p className="text-red-400 text-xs uppercase mb-1">Emergency contact</p>
          <p className="font-semibold">{guest.emergencyContactName || '—'}</p>
          {guest.emergencyContactPhone ? (
            <a
              href={`tel:${guest.emergencyContactPhone.replace(/\s/g, '')}`}
              className="staff-portal__btn-red inline-block mt-2"
            >
              CALL {guest.emergencyContactPhone}
            </a>
          ) : (
            <p className="text-neutral-500">No phone on file</p>
          )}
        </section>
        <section>
          <p className="text-red-400 text-xs uppercase mb-1">Travel insurance</p>
          <p>{guest.insuranceProvider || '—'}</p>
          <p className="font-mono text-xs text-neutral-400">{guest.insurancePolicyNumber || ''}</p>
        </section>
        <section>
          <p className="text-red-400 text-xs uppercase mb-1">Dietary / mobility</p>
          <p>{guest.dietaryRequirements || '—'}</p>
          <p className="text-neutral-400">{guest.mobilityNeeds || '—'}</p>
        </section>
        {onRefreshGps && (
          <button type="button" className="staff-portal__btn-ghost w-full" onClick={onRefreshGps}>
            Refresh GPS & copy link
          </button>
        )}
        {gps && (
          <a href={gps} target="_blank" rel="noopener noreferrer" className="staff-portal__btn-gold block text-center">
            Open GPS location
          </a>
        )}
        {guest.locationUpdatedAt && (
          <p className="text-[10px] text-neutral-500">
            Location updated{' '}
            {new Date(guest.locationUpdatedAt).toLocaleString('en-AU', {
              timeZone: 'Australia/Sydney',
            })}
          </p>
        )}
      </div>
    </div>
  )
}
