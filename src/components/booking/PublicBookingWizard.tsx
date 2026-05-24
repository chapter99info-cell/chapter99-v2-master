import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import {
  assertSlotAvailable,
  fetchDayBookings,
  fetchTherapistIds,
  slotWindow,
  type DayBooking,
} from '../../lib/bookingAvailability'
import { resolveShopNotificationEmail } from '../../lib/shopService'
import { sendBookingNotifications } from '../../lib/notifyService'
import type { Shop } from '../../types/pos'
import LegalAgreementCheckbox from '../legal/LegalAgreementCheckbox'
import {
  PUBLIC_STEPS,
  buildCancelUrl,
  buildGoogleCalendarUrl,
  buildSlotOptions,
  formatBookingRef,
  formatSydneyDateLabel,
  getUpcomingDays,
  groupServicesByCategory,
  pickFirstFreeTherapist,
  todaySydneyDateString,
  validateAuPhone,
  type PublicServiceRow,
  type PublicWizardStep,
  type SlotOption,
} from '../../lib/publicBooking'
import './PublicBookingWizard.css'

interface TherapistOption {
  id: string
  name_en: string
}

interface PublicBookingWizardProps {
  shopId: string
  shopSlug: string
  shop: Shop
  privacyHref: string
  termsHref: string
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(':').map(Number)
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d.toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatPrice(price: number, gstFree: boolean): string {
  return `$${price.toFixed(0)}${gstFree ? '' : ' incl. GST'}`
}

export default function PublicBookingWizard({
  shopId,
  shopSlug,
  shop,
  privacyHref,
  termsHref,
}: PublicBookingWizardProps) {
  const topRef = useRef<HTMLDivElement>(null)
  const [step, setStep] = useState<PublicWizardStep>('service')
  const [services, setServices] = useState<PublicServiceRow[]>([])
  const [serviceId, setServiceId] = useState('')
  const [date, setDate] = useState(todaySydneyDateString)
  const [time, setTime] = useState('')
  const [slotOptions, setSlotOptions] = useState<SlotOption[]>([])
  const [dayBookings, setDayBookings] = useState<DayBooking[]>([])
  const [therapistIds, setTherapistIds] = useState<string[]>([])
  const [therapists, setTherapists] = useState<TherapistOption[]>([])
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  const [legalAgreed, setLegalAgreed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [bookingId, setBookingId] = useState<string | null>(null)
  const [assignedTherapist, setAssignedTherapist] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(0)

  const selectedService = services.find(s => s.id === serviceId)
  const stepIndex = PUBLIC_STEPS.findIndex(s => s.id === step)
  const upcomingDays = getUpcomingDays(28)
  const visibleDays = upcomingDays.slice(calendarMonth * 7, calendarMonth * 7 + 7)

  const scrollTop = useCallback(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollTop()
  }, [step, scrollTop])

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name_en, name_th, duration, price, gst_free, category, image_url')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true })
      .then(({ data }) => setServices((data as PublicServiceRow[]) ?? []))

    fetchTherapistIds(supabase, shopId).then(setTherapistIds)

    supabase
      .from('staff')
      .select('id, name_en')
      .eq('shop_id', shopId)
      .eq('active', true)
      .in('role', ['therapist', 'owner', 'manager'])
      .order('name_en')
      .then(({ data }) => setTherapists((data as TherapistOption[]) ?? []))
  }, [shopId])

  const loadDay = useCallback(async () => {
    if (!date || !selectedService) return
    const bookings = await fetchDayBookings(supabase, shopId, date)
    setDayBookings(bookings)
    setSlotOptions(
      buildSlotOptions(date, selectedService.duration, bookings, therapistIds)
    )
  }, [date, shopId, selectedService, therapistIds])

  useEffect(() => {
    void loadDay()
  }, [loadDay])

  function goTo(next: PublicWizardStep) {
    setError('')
    setStep(next)
  }

  function canProceedFromService(): boolean {
    return !!serviceId
  }

  function canProceedFromDatetime(): boolean {
    return !!date && !!time
  }

  function canProceedFromDetails(): boolean {
    if (!firstName.trim() || !lastName.trim()) return false
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return false
    if (!validateAuPhone(phone)) return false
    if (!legalAgreed) return false
    return true
  }

  async function confirmBooking() {
    if (!selectedService || !time || !canProceedFromDetails()) {
      setError('Please complete all required fields and agree to the terms.')
      return
    }

    setLoading(true)
    setError('')

    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const start = new Date(`${date}T${time}:00+10:00`)
    const end = new Date(start.getTime() + selectedService.duration * 60_000)

    const freshBookings = await fetchDayBookings(supabase, shopId, date)
    const picked = pickFirstFreeTherapist(
      freshBookings,
      therapists,
      date,
      time,
      selectedService.duration
    )
    const staffId = picked?.id ?? null
    const therapistName = picked?.name ?? null
    setAssignedTherapist(therapistName)

    const { data: slotCheck } = await supabase.rpc('check_booking_slot', {
      p_shop_id: shopId,
      p_start: start.toISOString(),
      p_end: end.toISOString(),
      p_staff_id: staffId,
    })

    if (!slotCheck?.available) {
      setLoading(false)
      setError(slotCheck?.reason ?? 'This time slot is no longer available.')
      goTo('datetime')
      await loadDay()
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
      goTo('datetime')
      return
    }

    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .insert({
        shop_id: shopId,
        name: fullName,
        phone: phone.trim(),
        email: email.trim(),
      })
      .select('id')
      .single()

    if (clientErr || !clientRow) {
      setLoading(false)
      setError(clientErr?.message ?? 'Could not save your details.')
      return
    }

    const { data: booking, error: bookErr } = await supabase
      .from('bookings')
      .insert({
        shop_id: shopId,
        client_id: clientRow.id,
        service_id: serviceId,
        staff_id: staffId,
        therapist_name: therapistName,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        status: 'confirmed',
        source: 'online',
        medical_notes: notes.trim() || null,
      })
      .select('id')
      .single()

    setLoading(false)

    if (bookErr || !booking) {
      setError(bookErr?.message ?? 'Booking failed. Please try again.')
      return
    }

    setBookingId(booking.id as string)
    const dateLabel = formatSydneyDateLabel(date)
    const timeLabel = formatTime12(time)
    const cancelUrl = buildCancelUrl(shopSlug, booking.id as string)
    const ownerEmail = resolveShopNotificationEmail(shop)

    void sendBookingNotifications({
      shopId,
      bookingId: booking.id as string,
      shopSlug,
      clientName: fullName,
      clientEmail: email.trim(),
      clientPhone: phone.trim(),
      serviceName: selectedService.name_en,
      durationMin: selectedService.duration,
      dateLabel,
      time: timeLabel,
      therapistLabel: therapistName ?? 'Assigned on arrival',
      shopName: shop.name,
      shopAddress: shop.address,
      shopPhone: shop.phone,
      shopEmail: shop.email,
      ownerNotificationEmail: ownerEmail,
      logoUrl: shop.logoUrl,
      cancelUrl,
      totalPrice: selectedService.price,
      startIso: start.toISOString(),
    })

    goTo('done')
  }

  const grouped = groupServicesByCategory(services)
  const bookingRef = bookingId ? formatBookingRef(bookingId) : ''
  const dateLabel = formatSydneyDateLabel(date)
  const timeLabel = time ? formatTime12(time) : ''

  const googleCalUrl =
    bookingId && selectedService
      ? buildGoogleCalendarUrl({
          title: `${selectedService.name_en} at ${shop.name}`,
          startIso: new Date(`${date}T${time}:00+10:00`).toISOString(),
          endIso: new Date(
            new Date(`${date}T${time}:00+10:00`).getTime() +
              selectedService.duration * 60_000
          ).toISOString(),
          location: shop.address,
          details: `Booking ref: ${bookingRef}`,
        })
      : '#'

  return (
    <div className="public-booking-wizard" ref={topRef}>
      {step !== 'done' && (
        <>
          <div className="pbw-progress" role="progressbar" aria-valuenow={stepIndex + 1} aria-valuemin={1} aria-valuemax={4}>
            {PUBLIC_STEPS.map((s, i) => (
              <div
                key={s.id}
                className={`pbw-progress-seg ${i <= stepIndex ? 'done' : ''} ${i === stepIndex ? 'active' : ''}`}
                aria-hidden
              />
            ))}
          </div>
          <div className="pbw-progress-labels">
            {PUBLIC_STEPS.map((s, i) => (
              <span key={s.id} className={i === stepIndex ? 'active' : ''}>
                {i + 1}. {s.label}
              </span>
            ))}
          </div>
        </>
      )}

      {error && <div className="pbw-error" role="alert">{error}</div>}

      {step === 'service' && (
        <section className="pbw-step">
          <h2 className="pbw-step-title">Select your service</h2>
          <p className="pbw-step-lead">Choose a treatment to continue.</p>
          {services.length === 0 ? (
            <p>No services available for online booking right now.</p>
          ) : (
            Array.from(grouped.entries()).map(([category, list]) => (
              <div key={category}>
                <h3 className="pbw-category">{category}</h3>
                <div className="pbw-service-grid">
                  {list.map(svc => (
                    <button
                      key={svc.id}
                      type="button"
                      className={`pbw-service-card ${serviceId === svc.id ? 'selected' : ''}`}
                      onClick={() => setServiceId(svc.id)}
                    >
                      {svc.image_url ? (
                        <img
                          src={svc.image_url}
                          alt=""
                          className="pbw-service-img"
                        />
                      ) : (
                        <div className="pbw-service-img placeholder" aria-hidden>
                          💆
                        </div>
                      )}
                      <div className="pbw-service-body">
                        <p className="pbw-service-name">{svc.name_en}</p>
                        <p className="pbw-service-meta">{svc.duration} min</p>
                        <p className="pbw-service-price">
                          {formatPrice(svc.price, svc.gst_free)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))
          )}
          <div className="pbw-actions">
            <button
              type="button"
              className="pbw-btn pbw-btn-primary"
              disabled={!canProceedFromService()}
              onClick={() => goTo('datetime')}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 'datetime' && selectedService && (
        <section className="pbw-step">
          <h2 className="pbw-step-title">Select date & time</h2>
          <p className="pbw-step-lead">
            {selectedService.name_en} · {selectedService.duration} min · All times Sydney (AEST)
          </p>
          <div className="pbw-actions" style={{ marginTop: 0, marginBottom: 8 }}>
            <button
              type="button"
              className="pbw-btn pbw-btn-secondary"
              style={{ flex: '0 0 auto', minWidth: 'auto' }}
              disabled={calendarMonth === 0}
              onClick={() => setCalendarMonth(m => m - 1)}
            >
              ← Week
            </button>
            <button
              type="button"
              className="pbw-btn pbw-btn-secondary"
              style={{ flex: '0 0 auto', minWidth: 'auto' }}
              disabled={(calendarMonth + 1) * 7 >= upcomingDays.length}
              onClick={() => setCalendarMonth(m => m + 1)}
            >
              Week →
            </button>
          </div>
          <div className="pbw-calendar">
            {visibleDays.map(ymd => {
              const d = new Date(`${ymd}T12:00:00+10:00`)
              const isPast = ymd < todaySydneyDateString()
              const dow = d.toLocaleDateString('en-AU', {
                weekday: 'short',
                timeZone: 'Australia/Sydney',
              })
              const dayNum = d.getDate()
              return (
                <button
                  key={ymd}
                  type="button"
                  className={`pbw-cal-day ${date === ymd ? 'selected' : ''} ${isPast ? 'past' : ''}`}
                  disabled={isPast}
                  onClick={() => {
                    setDate(ymd)
                    setTime('')
                  }}
                >
                  <span className="dow">{dow}</span>
                  <span>{dayNum}</span>
                </button>
              )
            })}
          </div>
          {date && (
            <>
              <p className="pbw-step-lead">{formatSydneyDateLabel(date)}</p>
              <div className="pbw-slots">
                {slotOptions.map(slot => (
                  <button
                    key={slot.time}
                    type="button"
                    className={`pbw-slot ${time === slot.time ? 'selected' : ''}`}
                    disabled={!slot.available}
                    onClick={() => setTime(slot.time)}
                  >
                    {formatTime12(slot.time)}
                    <small>{slot.available ? slot.label : slot.label}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <div className="pbw-actions">
            <button type="button" className="pbw-btn pbw-btn-secondary" onClick={() => goTo('service')}>
              Back
            </button>
            <button
              type="button"
              className="pbw-btn pbw-btn-primary"
              disabled={!canProceedFromDatetime()}
              onClick={() => goTo('details')}
            >
              Continue
            </button>
          </div>
        </section>
      )}

      {step === 'details' && (
        <section className="pbw-step">
          <h2 className="pbw-step-title">Your details</h2>
          <p className="pbw-step-lead">We will send confirmation to your email and phone.</p>
          <div className="pbw-form">
            <div className="pbw-form-row">
              <label>
                First name *
                <input
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  required
                />
              </label>
              <label>
                Last name *
                <input
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  autoComplete="family-name"
                  required
                />
              </label>
            </div>
            <label>
              Mobile (Australia) *
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="04xx xxx xxx"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </label>
            <label>
              Email *
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Notes / special requests (optional)
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Allergies, pressure preference, etc."
              />
            </label>
            <LegalAgreementCheckbox
              checked={legalAgreed}
              onChange={setLegalAgreed}
              privacyHref={privacyHref}
              termsHref={termsHref}
              required
            />
            {!legalAgreed && (
              <p className="legal-agree-required">You must agree before continuing.</p>
            )}
          </div>
          <div className="pbw-actions">
            <button type="button" className="pbw-btn pbw-btn-secondary" onClick={() => goTo('datetime')}>
              Back
            </button>
            <button
              type="button"
              className="pbw-btn pbw-btn-primary"
              disabled={!canProceedFromDetails()}
              onClick={() => goTo('confirm')}
            >
              Review booking
            </button>
          </div>
        </section>
      )}

      {step === 'confirm' && selectedService && (
        <section className="pbw-step">
          <h2 className="pbw-step-title">Confirm & book</h2>
          <div className="pbw-summary">
            <dl>
              <div>
                <dt>Service</dt>
                <dd>{selectedService.name_en}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{dateLabel}</dd>
              </div>
              <div>
                <dt>Time</dt>
                <dd>{timeLabel} (Sydney)</dd>
              </div>
              <div>
                <dt>Therapist</dt>
                <dd>
                  {time && therapists.length > 0
                    ? pickFirstFreeTherapist(
                        dayBookings,
                        therapists,
                        date,
                        time,
                        selectedService.duration
                      )?.name ?? 'Assigned on arrival'
                    : 'Assigned on arrival'}
                </dd>
              </div>
              <div>
                <dt>Name</dt>
                <dd>
                  {firstName} {lastName}
                </dd>
              </div>
              <div>
                <dt>Contact</dt>
                <dd>
                  {phone} · {email}
                </dd>
              </div>
            </dl>
            <p className="pbw-total">
              Total: {formatPrice(selectedService.price, selectedService.gst_free)}
            </p>
          </div>
          <div className="pbw-actions">
            <button type="button" className="pbw-btn pbw-btn-secondary" onClick={() => goTo('details')}>
              Back
            </button>
            <button
              type="button"
              className="pbw-btn pbw-btn-primary"
              disabled={loading}
              onClick={() => void confirmBooking()}
            >
              {loading ? 'Booking…' : 'Confirm Booking'}
            </button>
          </div>
        </section>
      )}

      {step === 'done' && selectedService && bookingId && (
        <section className="pbw-done">
          <div className="pbw-done-icon" aria-hidden>
            ✅
          </div>
          <h2>Booking Confirmed!</h2>
          <p>Thank you, {firstName}. We have sent confirmation to your email and SMS.</p>
          <p className="pbw-ref">Reference: {bookingRef}</p>
          <p>
            {selectedService.name_en} · {dateLabel} at {timeLabel}
            {assignedTherapist ? ` · ${assignedTherapist}` : ''}
          </p>
          <div className="pbw-done-actions">
            <a
              className="pbw-btn pbw-btn-primary"
              href={googleCalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Add to Google Calendar
            </a>
            <button
              type="button"
              className="pbw-btn pbw-btn-secondary"
              onClick={() => {
                setStep('service')
                setServiceId('')
                setTime('')
                setBookingId(null)
                setLegalAgreed(false)
                setFirstName('')
                setLastName('')
                setPhone('')
                setEmail('')
                setNotes('')
              }}
            >
              Book another appointment
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
