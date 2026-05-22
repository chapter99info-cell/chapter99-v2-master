// Chapter99 V4 — 4-step booking wizard (staff dashboard)

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchShop } from '../../lib/shopService'
import { syncBookingToSheet } from '../../lib/googleSheets'
import { sendBookingConfirmationEmail } from '../../lib/notifyService'
import { fetchRooms } from '../../lib/roomService'
import type { Room } from '../../types/room'
import {
  assertSlotAvailable,
  evaluateSlotAvailability,
  fetchDayBookings,
  fetchTherapistIds,
  filterAvailableSlots,
  slotWindow,
  type DayBooking,
} from '../../lib/bookingAvailability'
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

interface TherapistOption {
  id: string
  name_en: string
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

const HH_MM_RE = /^(\d{1,2}):(\d{2})$/
const BUSINESS_OPEN_MINS = 10 * 60
const BUSINESS_CLOSE_MINS = 20 * 60

function normalizeHHMM(input: string): string | null {
  const m = input.trim().match(HH_MM_RE)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

function validateCustomTime(
  input: string,
  date: string,
  durationMin: number,
  bookings: DayBooking[],
  therapistIds: string[]
): string | null {
  const normalized = normalizeHHMM(input)
  if (!normalized) return 'Enter time as HH:MM (e.g. 14:30)'

  const [h, m] = normalized.split(':').map(Number)
  if (m % 30 !== 0) return 'Time must be in 30-minute increments (e.g. 10:00, 10:30)'

  const startMins = h * 60 + m
  if (startMins < BUSINESS_OPEN_MINS) return 'Earliest booking time is 10:00'

  const endMins = startMins + durationMin
  if (endMins > BUSINESS_CLOSE_MINS) {
    return `Service must finish by 20:00 (${durationMin} min from ${normalized})`
  }

  const { slotStart, slotEnd } = slotWindow(date, normalized, durationMin)
  const result = evaluateSlotAvailability(bookings, slotStart, slotEnd, therapistIds)
  if (!result.available) return result.reason ?? 'This time slot is full'

  return null
}

export default function BookingWizard({
  shopId,
  bookedBy,
  onComplete,
}: BookingWizardProps) {
  const [step, setStep] = useState<WizardStep>('service')
  const [services, setServices] = useState<ServiceRow[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [dayBookings, setDayBookings] = useState<DayBooking[]>([])
  const [therapistIds, setTherapistIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [customTimeError, setCustomTimeError] = useState('')
  const [therapists, setTherapists] = useState<TherapistOption[]>([])
  const [therapistId, setTherapistId] = useState('')
  const [therapistName, setTherapistName] = useState('')
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomId, setRoomId] = useState('')
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

  useEffect(() => {
    supabase
      .from('staff')
      .select('id, name_en')
      .eq('shop_id', shopId)
      .eq('active', true)
      .eq('role', 'therapist')
      .order('name_en')
      .then(({ data }) => {
        const list = (data as TherapistOption[]) ?? []
        setTherapists(list)
        setTherapistIds(list.map(t => t.id))
      })
    fetchRooms(supabase, shopId).then(setRooms).catch(() => setRooms([]))
  }, [shopId])

  const generateSlots = useCallback(async () => {
    if (!date || !serviceId || !selectedService) {
      setSlots([])
      return
    }
    setLoading(true)
    setError('')

    try {
      const [ids, existing] = await Promise.all([
        therapistIds.length > 0
          ? Promise.resolve(therapistIds)
          : fetchTherapistIds(supabase, shopId),
        fetchDayBookings(supabase, shopId, date),
      ])
      if (therapistIds.length === 0) setTherapistIds(ids)
      setDayBookings(existing)
      setSlots(filterAvailableSlots(date, selectedService.duration, existing, ids))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability')
      setSlots([])
    }
    setLoading(false)
  }, [date, shopId, serviceId, selectedService, therapistIds])

  function selectPresetSlot(slot: string) {
    setTime(slot)
    setCustomTime('')
    setCustomTimeError('')
  }

  function handleCustomTimeChange(value: string) {
    setCustomTime(value)
    if (!value.trim()) {
      setCustomTimeError('')
      return
    }
    if (!selectedService) {
      setCustomTimeError('Select a service first')
      setTime('')
      return
    }
    const err = validateCustomTime(value, date, selectedService.duration, dayBookings, therapistIds)
    setCustomTimeError(err ?? '')
    if (!err) {
      const normalized = normalizeHHMM(value)
      if (normalized) setTime(normalized)
    } else {
      setTime('')
    }
  }

  useEffect(() => {
    if (step === 'datetime') generateSlots()
  }, [step, generateSlots])

  useEffect(() => {
    if (!customTime.trim() || !selectedService) return
    const err = validateCustomTime(
      customTime,
      date,
      selectedService.duration,
      dayBookings,
      therapistIds
    )
    setCustomTimeError(err ?? '')
    if (!err) {
      const normalized = normalizeHHMM(customTime)
      if (normalized) setTime(normalized)
    } else {
      setTime('')
    }
  }, [dayBookings, date, selectedService, customTime, therapistIds])

  async function saveBooking() {
    if (!selectedService || !time || !clientName.trim()) return
    setLoading(true)
    setError('')

    const start = new Date(`${date}T${time}:00+10:00`)
    const end = new Date(start.getTime() + selectedService.duration * 60_000)

    const staffId = therapistId || null

    const { data: slotCheck } = await supabase.rpc('check_booking_slot', {
      p_shop_id: shopId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_staff_id: staffId,
    })

    if (!slotCheck?.available) {
      setLoading(false)
      setError(slotCheck?.reason ?? 'This time slot is full. Please choose another time.')
      await generateSlots()
      setStep('datetime')
      return
    }

    const localCheck = await assertSlotAvailable(
      supabase,
      shopId,
      date,
      time,
      selectedService.duration,
      staffId
    )
    if (!localCheck.available) {
      setLoading(false)
      setError(localCheck.reason ?? 'This time slot is full.')
      await generateSlots()
      setStep('datetime')
      return
    }

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
        staff_id: staffId,
        therapist_name: therapistName.trim() || null,
        room_id: roomId || null,
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
      const shop = await fetchShop(shopId)
      if (shop.googleSheetSyncEnabled && shop.googleSheetUrl && selectedService) {
        void syncBookingToSheet(shop.googleSheetUrl, shopId, {
          bookingId: booking.id,
          date,
          time,
          service: selectedService.name_en,
          customer: clientName.trim(),
          phone: clientPhone.trim(),
          status: 'confirmed',
        })
      }

      const email = clientEmail.trim()
      if (email) {
        const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
        void sendBookingConfirmationEmail({
          to: email,
          clientName: clientName.trim(),
          serviceName: selectedService.name_en,
          durationMin: selectedService.duration,
          date: dateLabel,
          time,
          therapistLabel: therapistName.trim() || 'No preference',
          shopName: shop.name,
          shopAddress: shop.address,
          shopPhone: shop.phone,
        })
      }

      onComplete?.(booking.id)
      setStep('done')
    }
  }

  function resetWizard() {
    setStep('service')
    setServiceId('')
    setTime('')
    setCustomTime('')
    setCustomTimeError('')
    setTherapistId('')
    setTherapistName('')
    setRoomId('')
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
                    setCustomTime('')
                    setCustomTimeError('')
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
              setCustomTime('')
              setCustomTimeError('')
            }}
          />

          {loading ? (
            <p className="bw-hint">Checking availability…</p>
          ) : slots.length === 0 ? (
            <p className="bw-empty">
              No slots on this date — try another day.
              {therapistIds.length > 0 && (
                <> ({therapistIds.length} therapist{therapistIds.length === 1 ? '' : 's'} — all may be booked at remaining times)</>
              )}
            </p>
          ) : (
            <div className="bw-slots">
              {slots.map(slot => (
                <button
                  key={slot}
                  type="button"
                  className={`bw-slot${time === slot ? ' selected' : ''}`}
                  onClick={() => selectPresetSlot(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}

          <div className="bw-custom-time">
            <label className="bw-label" htmlFor="bw-custom-time">
              Custom time
            </label>
            <input
              id="bw-custom-time"
              type="text"
              className={`bw-input${customTimeError ? ' invalid' : ''}`}
              placeholder="HH:MM (e.g. 14:30)"
              value={customTime}
              inputMode="numeric"
              maxLength={5}
              onChange={e => handleCustomTimeChange(e.target.value)}
            />
            {customTimeError ? (
              <p className="bw-field-error">{customTimeError}</p>
            ) : (
              <p className="bw-hint">10:00–20:00, 30-minute increments</p>
            )}
          </div>

          <div className="bw-nav">
            <button type="button" className="bw-btn secondary" onClick={() => setStep('service')}>
              ← Back
            </button>
            <button
              type="button"
              className="bw-btn primary"
              disabled={!time || !!customTimeError}
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
          <label className="bw-label" htmlFor="bw-therapist">
            Preferred therapist
          </label>
          <select
            id="bw-therapist"
            className="bw-input"
            value={therapistId}
            onChange={e => {
              const id = e.target.value
              setTherapistId(id)
              const t = therapists.find(x => x.id === id)
              setTherapistName(t?.name_en ?? '')
            }}
          >
            <option value="">No preference</option>
            {therapists.map(t => (
              <option key={t.id} value={t.id}>
                {t.name_en}
              </option>
            ))}
          </select>
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

          <label className="bw-label" htmlFor="bw-room">
            Room (optional)
          </label>
          <select
            id="bw-room"
            className="bw-input"
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
          >
            <option value="">— Unassigned —</option>
            {rooms.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>

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
            <div className="bw-summary-row">
              <span>Therapist</span>
              <strong>{therapistName || 'No preference'}</strong>
            </div>
            <div className="bw-summary-row">
              <span>Room</span>
              <strong>
                {roomId
                  ? rooms.find(r => r.id === roomId)?.name ?? '— Unassigned —'
                  : '— Unassigned —'}
              </strong>
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
