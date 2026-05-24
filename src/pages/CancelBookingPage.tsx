import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import './PublicSite.css'

interface CancelPreview {
  shop: { name: string; slug: string }
  booking: {
    id: string
    status: string
    start_time: string
    services: { name_en: string; duration: number } | null
    clients: { name: string } | null
    therapist_name: string | null
  }
}

export default function CancelBookingPage() {
  const [searchParams] = useSearchParams()
  const bookingId = searchParams.get('booking')?.trim() ?? ''
  const shopSlug = searchParams.get('shop')?.trim().toLowerCase() ?? ''
  const { withShopQuery, loading: shopLoading } = useShopContext()

  const [preview, setPreview] = useState<CancelPreview | null>(null)
  const [loadError, setLoadError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!bookingId || !shopSlug) {
      setLoadError('Invalid cancellation link.')
      return
    }

    const params = new URLSearchParams({ booking: bookingId, shop: shopSlug })
    fetch(`/api/cancel-booking?${params}`)
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not load booking')
        setPreview(data as CancelPreview)
      })
      .catch(e => {
        setLoadError(e instanceof Error ? e.message : 'Could not load booking')
      })
  }, [bookingId, shopSlug])

  async function handleCancel() {
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/cancel-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, shopSlug }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Cancellation failed')
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancellation failed')
    } finally {
      setSubmitting(false)
    }
  }

  const start = preview?.booking.start_time
    ? new Date(preview.booking.start_time)
    : null
  const dateLabel = start
    ? start.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Australia/Sydney',
      })
    : ''
  const timeLabel = start
    ? start.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney',
      })
    : ''

  const alreadyCancelled =
    preview?.booking.status === 'cancelled' || done

  return (
    <div className="public-page public-cancel-page">
      <p className="public-eyebrow">Booking</p>
      <h1 className="public-page-title">Cancel your booking</h1>

      {shopLoading && <p>Loading…</p>}
      {loadError && <p className="pbw-error">{loadError}</p>}

      {preview && !loadError && (
        <>
          {alreadyCancelled ? (
            <p className="public-page-lead">
              This booking has been cancelled. Contact {preview.shop.name} if you need
              help rebooking.
            </p>
          ) : (
            <>
              <p className="public-page-lead">
                {preview.booking.clients?.name ?? 'Guest'} —{' '}
                {preview.booking.services?.name_en ?? 'Appointment'}
              </p>
              <p>
                {dateLabel} at {timeLabel}
                {preview.booking.therapist_name
                  ? ` · ${preview.booking.therapist_name}`
                  : ''}
              </p>
              <p style={{ marginTop: 16 }}>
                24 hours notice is required where possible. Cancelling will notify the
                shop by email and SMS.
              </p>
              {error && <p className="pbw-error">{error}</p>}
              <div className="pbw-actions" style={{ marginTop: 24 }}>
                <Link className="pbw-btn pbw-btn-secondary" to={withShopQuery('/book')}>
                  Keep booking
                </Link>
                <button
                  type="button"
                  className="pbw-btn pbw-btn-primary"
                  style={{ background: '#993c1d' }}
                  disabled={submitting}
                  onClick={() => void handleCancel()}
                >
                  {submitting ? 'Cancelling…' : 'Confirm cancellation'}
                </button>
              </div>
            </>
          )}
          <p style={{ marginTop: 24 }}>
            <Link to={withShopQuery('/')}>Back to home</Link>
          </p>
        </>
      )}
    </div>
  )
}
