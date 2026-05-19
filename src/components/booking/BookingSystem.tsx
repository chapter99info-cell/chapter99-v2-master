// Chapter99 V4 — Phase 3
// Booking System — Online + Walk-in + Phone-in
// Conflict-free with 5-min slot lock

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

type BookingSource = 'online' | 'walkin' | 'phone'
type BookingStep = 'service' | 'datetime' | 'preferences' | 'confirm' | 'done'

interface BookingForm {
  serviceId: string
  staffId: string
  date: string
  time: string
  clientName: string
  clientPhone: string
  clientEmail: string
  pressurePref: number
  focusAreas: string[]
  medicalNotes: string
  source: BookingSource
  bookedBy?: string
}

const PRESSURE_LABELS = ['', 'Soft / Relaxing', 'Medium / Firm', 'Deep Tissue / Strong']
const FOCUS_AREAS = [
  'Head / Temples', 'Neck', 'Shoulders', 'Upper Back',
  'Lower Back', 'Arms / Hands', 'Legs / Feet',
]

interface BookingSystemProps {
  shopId: string
  mode?: BookingSource  // 'online' for customer, 'walkin'/'phone' for staff
  onComplete?: (bookingId: string) => void
}

export default function BookingSystem({ shopId, mode = 'online', onComplete }: BookingSystemProps) {
  const [step, setStep] = useState<BookingStep>('service')
  const [services, setServices] = useState<any[]>([])
  const [staff, setStaff] = useState<any[]>([])
  const [availableSlots, setAvailableSlots] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [lockedSlot, setLockedSlot] = useState<string | null>(null)

  const [form, setForm] = useState<BookingForm>({
    serviceId: '',
    staffId: '',
    date: new Date().toISOString().split('T')[0],
    time: '',
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    pressurePref: 2,
    focusAreas: [],
    medicalNotes: '',
    source: mode,
  })

  const set = (key: keyof BookingForm, val: any) =>
    setForm(prev => ({ ...prev, [key]: val }))

  // Load services
  useEffect(() => {
    supabase.from('services')
      .select('*')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('sort_order')
      .then(({ data }) => setServices(data ?? []))
  }, [shopId])

  // Load staff when service selected
  useEffect(() => {
    if (!form.serviceId) return
    supabase.from('staff')
      .select('id, name_en, name_th')
      .eq('shop_id', shopId)
      .eq('active', true)
      .then(({ data }) => setStaff(data ?? []))
  }, [form.serviceId])

  // Generate available time slots
  useEffect(() => {
    if (!form.date || !form.staffId || !form.serviceId) return
    generateSlots()
  }, [form.date, form.staffId, form.serviceId])

  async function generateSlots() {
    setLoading(true)
    const svc = services.find(s => s.id === form.serviceId)
    if (!svc) return

    // Get existing bookings for selected staff + date
    const dayStart = `${form.date}T00:00:00+10:00`
    const dayEnd = `${form.date}T23:59:59+10:00`

    const { data: existing } = await supabase
      .from('bookings')
      .select('start_time, end_time')
      .eq('staff_id', form.staffId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .neq('status', 'cancelled')

    // Build slots 10am-8pm every 30min
    const slots: string[] = []
    for (let h = 10; h <= 19; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slotTime = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
        const slotStart = new Date(`${form.date}T${slotTime}:00+10:00`)
        const slotEnd = new Date(slotStart.getTime() + svc.duration * 60000)

        // Check no conflict
        const conflict = (existing ?? []).some(b => {
          const bStart = new Date(b.start_time)
          const bEnd = new Date(b.end_time)
          return slotStart < bEnd && slotEnd > bStart
        })

        if (!conflict && slotEnd.getHours() <= 20) {
          slots.push(slotTime)
        }
      }
    }
    setAvailableSlots(slots)
    setLoading(false)
  }

  // Lock slot for 5 minutes
  async function lockSlot(time: string) {
    set('time', time)
    const sessionId = `session-${Date.now()}`
    const svc = services.find(s => s.id === form.serviceId)
    const start = new Date(`${form.date}T${time}:00+10:00`).toISOString()
    const end = new Date(new Date(start).getTime() + svc.duration * 60000).toISOString()

    const { data } = await supabase.rpc('lock_slot', {
      p_shop_id: shopId,
      p_staff_id: form.staffId,
      p_start: start,
      p_end: end,
      p_session_id: sessionId,
    })

    if (data?.available) {
      setLockedSlot(time)
      setStep('preferences')
      // Release lock after 5 min if not confirmed
      setTimeout(() => setLockedSlot(null), 5 * 60 * 1000)
    } else {
      alert('This slot was just taken. Please choose another time.')
      generateSlots()
    }
  }

  // Submit booking
  async function confirmBooking() {
    if (!lockedSlot) return
    setLoading(true)

    const svc = services.find(s => s.id === form.serviceId)
    const start = new Date(`${form.date}T${form.time}:00+10:00`).toISOString()
    const end = new Date(new Date(start).getTime() + svc.duration * 60000).toISOString()

    // Upsert client
    let clientId: string | null = null
    if (form.clientPhone || form.clientEmail) {
      const { data: client } = await supabase
        .from('clients')
        .upsert({
          shop_id: shopId,
          name: form.clientName,
          phone: form.clientPhone,
          email: form.clientEmail,
          pressure_pref: form.pressurePref,
          focus_areas: form.focusAreas,
        }, { onConflict: 'shop_id,phone' })
        .select('id')
        .single()
      clientId = client?.id ?? null
    }

    // Create booking
    const { data: booking, error } = await supabase
      .from('bookings')
      .insert({
        shop_id: shopId,
        client_id: clientId,
        service_id: form.serviceId,
        staff_id: form.staffId,
        start_time: start,
        end_time: end,
        status: 'confirmed',
        source: form.source,
        pressure_pref: form.pressurePref,
        focus_areas: form.focusAreas,
        medical_notes: form.medicalNotes,
        booked_by: form.bookedBy,
      })
      .select('id')
      .single()

    setLoading(false)

    if (!error && booking) {
      // Send SMS confirmation
      if (form.clientPhone) {
        await fetch('/api/sms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to: form.clientPhone,
            message: `Hi ${form.clientName}! Your booking is confirmed for ${form.date} at ${form.time}. We look forward to seeing you!`,
          }),
        })
      }
      setStep('done')
      onComplete?.(booking.id)
    }
  }

  const selectedService = services.find(s => s.id === form.serviceId)
  const selectedStaff = staff.find(s => s.id === form.staffId)

  return (
    <div className="booking-system">
      {/* Progress */}
      <div className="booking-progress">
        {(['service', 'datetime', 'preferences', 'confirm'] as BookingStep[]).map((s, i) => (
          <div key={s} className={`progress-step${step === s ? ' active' : ''}${
            ['service','datetime','preferences','confirm','done'].indexOf(step) > i ? ' done' : ''
          }`}>
            <div className="progress-dot">{i + 1}</div>
            <div className="progress-label">{s === 'datetime' ? 'Date & Time' : s.charAt(0).toUpperCase() + s.slice(1)}</div>
          </div>
        ))}
      </div>

      {/* Step 1: Select Service */}
      {step === 'service' && (
        <div className="booking-step">
          <h2 className="step-title">Select Service</h2>
          <div className="service-list">
            {services.map(svc => (
              <div
                key={svc.id}
                className={`service-card${form.serviceId === svc.id ? ' selected' : ''}`}
                onClick={() => { set('serviceId', svc.id); set('staffId', '') }}
              >
                <div className="service-card-name">{svc.name_en}</div>
                <div className="service-card-meta">{svc.duration} min {svc.gst_free ? '· GST-free' : ''}</div>
                <div className="service-card-price">${svc.price} AUD</div>
              </div>
            ))}
          </div>

          {form.serviceId && (
            <>
              <h3 className="step-subtitle">Select Therapist</h3>
              <div className="staff-list">
                <div
                  className={`staff-card${form.staffId === 'any' ? ' selected' : ''}`}
                  onClick={() => set('staffId', staff[0]?.id ?? '')}
                >
                  Any available therapist
                </div>
                {staff.map(s => (
                  <div
                    key={s.id}
                    className={`staff-card${form.staffId === s.id ? ' selected' : ''}`}
                    onClick={() => set('staffId', s.id)}
                  >
                    {s.name_en}
                  </div>
                ))}
              </div>
            </>
          )}

          <button
            className="booking-next-btn"
            disabled={!form.serviceId || !form.staffId}
            onClick={() => setStep('datetime')}
          >
            Next →
          </button>
        </div>
      )}

      {/* Step 2: Date & Time */}
      {step === 'datetime' && (
        <div className="booking-step">
          <h2 className="step-title">Choose Date & Time</h2>
          <input
            type="date"
            className="booking-date-input"
            value={form.date}
            min={new Date().toISOString().split('T')[0]}
            onChange={e => set('date', e.target.value)}
          />

          {loading ? (
            <div className="slots-loading">Checking availability...</div>
          ) : availableSlots.length === 0 ? (
            <div className="slots-empty">No availability on this date. Please try another day.</div>
          ) : (
            <div className="slots-grid">
              {availableSlots.map(slot => (
                <button
                  key={slot}
                  className={`slot-btn${form.time === slot ? ' selected' : ''}`}
                  onClick={() => lockSlot(slot)}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}

          <button className="booking-back-btn" onClick={() => setStep('service')}>← Back</button>
        </div>
      )}

      {/* Step 3: Client + Preferences */}
      {step === 'preferences' && (
        <div className="booking-step">
          <h2 className="step-title">Your Details & Preferences</h2>

          {lockedSlot && (
            <div className="slot-locked-notice">
              ✅ {form.date} at {form.time} — held for 5 minutes
            </div>
          )}

          <input className="booking-input" placeholder="Full Name *"
            value={form.clientName} onChange={e => set('clientName', e.target.value)} />
          <input className="booking-input" placeholder="Phone number"
            value={form.clientPhone} onChange={e => set('clientPhone', e.target.value)} />
          <input className="booking-input" placeholder="Email (for receipt)"
            value={form.clientEmail} onChange={e => set('clientEmail', e.target.value)} />

          <div className="pref-label">Preferred Pressure</div>
          <div className="pressure-selector">
            {[1, 2, 3].map(p => (
              <button
                key={p}
                className={`pressure-btn${form.pressurePref === p ? ' active' : ''}`}
                onClick={() => set('pressurePref', p)}
              >
                <div className="pressure-num">{p}</div>
                <div className="pressure-label">{PRESSURE_LABELS[p]}</div>
              </button>
            ))}
          </div>

          <div className="pref-label">Focus Areas (select all that apply)</div>
          <div className="focus-grid">
            {FOCUS_AREAS.map(area => (
              <button
                key={area}
                className={`focus-btn${form.focusAreas.includes(area) ? ' active' : ''}`}
                onClick={() => set('focusAreas', form.focusAreas.includes(area)
                  ? form.focusAreas.filter(a => a !== area)
                  : [...form.focusAreas, area]
                )}
              >
                {area}
              </button>
            ))}
          </div>

          <textarea className="booking-textarea"
            placeholder="Any injuries, medical conditions, or areas to avoid?"
            value={form.medicalNotes}
            onChange={e => set('medicalNotes', e.target.value)}
            rows={3}
          />

          <div className="booking-nav">
            <button className="booking-back-btn" onClick={() => setStep('datetime')}>← Back</button>
            <button
              className="booking-next-btn"
              disabled={!form.clientName}
              onClick={() => setStep('confirm')}
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirm */}
      {step === 'confirm' && (
        <div className="booking-step">
          <h2 className="step-title">Confirm Booking</h2>
          <div className="confirm-card">
            <div className="confirm-row"><span>Service</span><strong>{selectedService?.name_en}</strong></div>
            <div className="confirm-row"><span>Duration</span><strong>{selectedService?.duration} min</strong></div>
            <div className="confirm-row"><span>Price</span><strong>${selectedService?.price} AUD</strong></div>
            <div className="confirm-row"><span>Therapist</span><strong>{selectedStaff?.name_en}</strong></div>
            <div className="confirm-row"><span>Date</span><strong>{form.date}</strong></div>
            <div className="confirm-row"><span>Time</span><strong>{form.time}</strong></div>
            <div className="confirm-row"><span>Name</span><strong>{form.clientName}</strong></div>
            <div className="confirm-row"><span>Phone</span><strong>{form.clientPhone}</strong></div>
            <div className="confirm-row"><span>Pressure</span><strong>{PRESSURE_LABELS[form.pressurePref]}</strong></div>
            {form.focusAreas.length > 0 && (
              <div className="confirm-row"><span>Focus</span><strong>{form.focusAreas.join(', ')}</strong></div>
            )}
          </div>

          <div className="consent-notice">
            By confirming, you agree to our terms and consent to treatment.
          </div>

          <div className="booking-nav">
            <button className="booking-back-btn" onClick={() => setStep('preferences')}>← Back</button>
            <button
              className="booking-confirm-btn"
              disabled={loading}
              onClick={confirmBooking}
            >
              {loading ? 'Booking...' : '✅ Confirm Booking'}
            </button>
          </div>
        </div>
      )}

      {/* Done */}
      {step === 'done' && (
        <div className="booking-done">
          <div className="done-icon">✅</div>
          <h2>Booking Confirmed!</h2>
          <p>We'll see you on {form.date} at {form.time}</p>
          {form.clientPhone && <p>SMS confirmation sent to {form.clientPhone}</p>}
          <button className="booking-next-btn" onClick={() => {
            setStep('service')
            setForm(f => ({ ...f, serviceId: '', staffId: '', time: '', clientName: '' }))
          }}>
            Book Another
          </button>
        </div>
      )}
    </div>
  )
}
