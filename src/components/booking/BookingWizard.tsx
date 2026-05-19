// Chapter99 V4 — 4-step booking wizard (staff dashboard)

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import './BookingWizard.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

type WizardStep = 'service' | 'datetime' | 'client' | 'confirm' | 'done'

interface ServiceRow {
  id: string
  name_en: string
  name_th: string | null
  duration: number
  price: number
  gst_free: boolean
}

interface BookingWizardProps {
  shopId: string
  bookedBy?: string
  onComplete?: (bookingId: string) => void
}

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'service', label: 'Service' },
  { id: 'datetime', label: 'Date & Time' },
  { id: 'client', label: 'Client' },
  { id: 'confirm', label: 'Confirm' },
]

export default function BookingWizard({
  shopId,
  bookedBy,
  onComplete,
}: BookingWizardProps) {
  const [step, setStep] = useState<WizardStep>('service')
  const [services, setServices] = useState<ServiceRow[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('')
  const [clientName, setClientName] = useState('')
  const [clientPhone, setClientPhone] = useState('')
  const [clientEmail, setClientEmail] = useState('')

  const selectedService = services.find(s => s.id === serviceId)

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name_en, name_th, duration, price, gst_free')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setServices((data as ServiceRow[]) ?? [])
      })
  }, [shopId])

  const generateSlots = useCallback(async () => {
    if (!date || !serviceId || !selectedService) {
      setSlots([])
      return
    }
    setLoading(true)
    setError('')

    const dayStart = `${date}T00:00:00+10:00`
    const dayEnd = `${date}T23:59:59+10:00`

    const { data: existing } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('shop_id', shopId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .neq('status', 'cancelled')

    const durationMs = selectedService.duration * 60_000
    const available: string[] = []

    for (let h = 10; h <= 19; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotTime = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
        const slotStart = new Date(`${date}T${slotTime}:00+10:00`)
        const slotEnd = new Date(slotStart.getTime() + durationMs)

        const conflict = (existing ?? []).some(b => {
          const bStart = new Date(b.start_time)
          const bEnd = new Date(b.end_time)
          return slotStart < bEnd && slotEnd > bStart
        })

        if (!conflict && slotEnd.getHours() <= 20) {
          available.push(slotTime)
        }
      }
    }

    setSlots(available)
    setLoading(false)
  }, [date, shopId, serviceId, selectedService])

  useEffect(() => {
    if (step === 'datetime') generateSlots()
  }, [step, generateSlots])

  async function saveBooking() {
    if (!selectedService || !time || !clientName.trim()) return
    setLoading(true)
    setError('')

    const start = new Date(`${date}T${time}:00+10:00`)
    const end = new Date(start.getTime() + selectedService.duration * 60_000)

    let clientId: string | null = null
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .insert({
        shop_id: shopId,
        name: clientName.trim(),
        phone: clientPhone.trim() || null,
        email: clientEmail.trim() || null,
      })
      .select('id')
      .single()

    if (!clientErr && clientRow) clientId = clientRow.id

    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        shop_id: shopId,
        client_id: clientId,
        service_id: serviceId,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'confirmed',
        source: 'walkin',
        booked_by: bookedBy,
      })
      .select('id')
      .single()

    setLoading(false)

    if (bookErr) {
      setError(bookErr.message)
      return
    }

    if (booking) {
      onComplete?.(booking.id)
      setStep('done')
    }
  }

  function resetWizard() {
    setStep('service')
    setServiceId('')
    setTime('')
    setClientName('')
    setClientPhone('')
    setClientEmail('')
    setError('')
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className="booking-wizard">
      <div className="bw-progress">
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`bw-progress-step${
              step === s.id ? ' active' : ''
            }${stepIndex > i || step === 'done' ? ' done' : ''}`}
          >
            <span className="bw-progress-num">{i + 1}</span>
            <span className="bw-progress-label">{s.label}</span>
          </div>
        ))}
      </div>

      {error && <div className="bw-error">{error}</div>}

      {step === 'service' && (
        <div className="bw-step">
          <h2 className="bw-title">Select service</h2>
          {services.length === 0 ? (
            <p className="bw-empty">No active services — add them in Services (Owner).</p>
          ) : (
            <div className="bw-service-grid">
              {services.map(svc => (
                <button
                  key={svc.id}
                  type="button"
                  className={`bw-service-card${serviceId === svc.id ? ' selected' : ''}`}
                  onClick={() => {
                    setServiceId(svc.id)
                    setTime('')
                  }}
                >
                  <div className="bw-service-name">{svc.name_en}</div>
                  {svc.name_th && <div className="bw-service-th">{svc.name_th}</div>}
                  <div className="bw-service-meta">
                    {svc.duration} min · ${Number(svc.price).toFixed(2)}
                    {svc.gst_free ? ' · GST-free' : ''}
                  </div>
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            className="bw-btn primary"
            disabled={!serviceId}
            onClick={() => setStep('datetime')}
          >
            Next →
          </button>
        </div>
      )}

      {step === 'datetime' && (
        <div className="bw-step">
          <h2 className="bw-title">Date & time</h2>
          <label className="bw-label">Date</label>
          <input
            type="date"
            className="bw-input"
            value={date}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => {
              setDate(e.target.value)
              setTime('')
            }}
          />

          {loading ? (
            <p className="bw-hint">Checking availability…</p>
          ) : slots.length === 0 ? (
            <p className="bw-empty">No slots on this date — try another day.</p>
          ) : (
            <div className="bw-slots">
              {slots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  className={`bw-slot${time === slot ? ' selected' : ''}`}
                  onClick={() => setTime(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}

          <div className="bw-nav">
            <button type="button" className="bw-btn secondary" onClick={() => setStep('service')}>
              ← Back
            </button>
            <button
              type="button"
              className="bw-btn primary"
              disabled={!time}
              onClick={() => setStep('client')}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {step === 'client' && (
        <div className="bw-step">
          <h2 className="bw-title">Client information</h2>
          <p className="bw-hint">
            {date} at {time} · {selectedService?.name_en}
          </p>
          <input
            className="bw-input"
            placeholder="Full name *"
            value={clientName}
            onChange={e => setClientName(e.target.value)}
          />
          <input
            className="bw-input"
            placeholder="Phone"
            value={clientPhone}
            onChange={e => setClientPhone(e.target.value)}
          />
          <input
            className="bw-input"
            placeholder="Email"
            type="email"
            value={clientEmail}
            onChange={e => setClientEmail(e.target.value)}
          />
          <div className="bw-nav">
            <button type="button" className="bw-btn secondary" onClick={() => setStep('datetime')}>
              ← Back
            </button>
            <button
              type="button"
              className="bw-btn primary"
              disabled={!clientName.trim()}
              onClick={() => setStep('confirm')}
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bw-step">
          <h2 className="bw-title">Confirm booking</h2>
          <div className="bw-summary">
            <div className="bw-summary-row">
              <span>Service</span>
              <strong>{selectedService?.name_en}</strong>
            </div>
            <div className="bw-summary-row">
              <span>Duration</span>
              <strong>{selectedService?.duration} min</strong>
            </div>
            <div className="bw-summary-row">
              <span>Price</span>
              <strong>${Number(selectedService?.price ?? 0).toFixed(2)}</strong>
            </div>
            <div className="bw-summary-row">
              <span>When</span>
              <strong>
                {date} {time}
              </strong>
            </div>
            <div className="bw-summary-row">
              <span>Client</span>
              <strong>{clientName}</strong>
            </div>
            {clientPhone && (
              <div className="bw-summary-row">
                <span>Phone</span>
                <strong>{clientPhone}</strong>
              </div>
            )}
          </div>
          <div className="bw-nav">
            <button type="button" className="bw-btn secondary" onClick={() => setStep('client')}>
              ← Back
            </button>
            <button
              type="button"
              className="bw-btn primary"
              disabled={loading}
              onClick={saveBooking}
            >
              {loading ? 'Saving…' : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bw-step bw-done">
          <div className="bw-done-icon">✓</div>
          <h2>Booking confirmed</h2>
          <p>
            {clientName} — {date} at {time}
          </p>
          <button type="button" className="bw-btn primary" onClick={resetWizard}>
            Book another
          </button>
        </div>
      )}
    </div>
  )
}
