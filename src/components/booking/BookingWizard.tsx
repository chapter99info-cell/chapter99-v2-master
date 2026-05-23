// Chapter99 V4 — 4-step booking wizard (staff dashboard)

import { useState, useEffect, useCallback } from 'react'
import { fetchShop, resolveShopNotificationEmail } from '../../lib/shopService'
import { syncBookingToSheet } from '../../lib/googleSheets'
import { sendBookingConfirmationEmail, sendOwnerBookingNotificationEmail } from '../../lib/notifyService'
import { fetchRooms } from '../../lib/roomService'
import { supabase } from '../../lib/supabase'
import type { Room } from '../../types/room'
import {
  assertSlotAvailable,
  assignCoupleTherapists,
  evaluateCoupleSlotAvailability,
  evaluateSlotAvailability,
  fetchDayBookings,
  fetchTherapistIds,
  filterAvailableCoupleSlots,
  filterAvailableSlots,
  slotWindow,
  type DayBooking,
} from '../../lib/bookingAvailability'
import './BookingWizard.css'

/** Rooms available for assignment (active or legacy rows with null active). */
function bookableRooms(rooms: Room[]): Room[] {
  return rooms.filter(r => r.active !== false)
}

type WizardStep = 'service' | 'datetime' | 'client' | 'confirm' | 'done'
type BookingMode = 'solo' | 'couple'

interface ClientFields {
  name: string
  phone: string
  email: string
  therapistId: string
  therapistName: string
  roomId: string
}

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
  /** `public` = customer online booking at /book (no staff UI). */
  variant?: 'staff' | 'public'
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
  therapistIds: string[],
  couple: boolean
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
  const result = couple
    ? evaluateCoupleSlotAvailability(bookings, slotStart, slotEnd, therapistIds)
    : evaluateSlotAvailability(bookings, slotStart, slotEnd, therapistIds)
  if (!result.available) return result.reason ?? 'This time slot is full'

  return null
}

export default function BookingWizard({
  shopId,
  bookedBy,
  onComplete,
  variant = 'staff',
}: BookingWizardProps) {
  const isPublic = variant === 'public'
  const bookingSource = isPublic ? 'online' : 'walkin'
  const [step, setStep] = useState<WizardStep>('service')
  const [services, setServices] = useState<ServiceRow[]>([])
  const [slots, setSlots] = useState<string[]>([])
  const [dayBookings, setDayBookings] = useState<DayBooking[]>([])
  const [therapistIds, setTherapistIds] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastBookingId, setLastBookingId] = useState<string | null>(null)

  const [bookingMode, setBookingMode] = useState<BookingMode>('solo')
  const [differentServiceP2, setDifferentServiceP2] = useState(false)
  const [serviceId, setServiceId] = useState('')
  const [serviceId2, setServiceId2] = useState('')
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0])
  const [time, setTime] = useState('')
  const [customTime, setCustomTime] = useState('')
  const [customTimeError, setCustomTimeError] = useState('')
  const [therapists, setTherapists] = useState<TherapistOption[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [roomsLoading, setRoomsLoading] = useState(false)
  const [person1, setPerson1] = useState<ClientFields>({
    name: '',
    phone: '',
    email: '',
    therapistId: '',
    therapistName: '',
    roomId: '',
  })
  const [person2, setPerson2] = useState<ClientFields>({
    name: '',
    phone: '',
    email: '',
    therapistId: '',
    therapistName: '',
    roomId: '',
  })

  const selectedService = services.find(s => s.id === serviceId)
  const selectedService2 = services.find(
    s => s.id === (differentServiceP2 ? serviceId2 : serviceId)
  )
  const isCouple = !isPublic && bookingMode === 'couple'
  const slotDurationMin = isCouple
    ? Math.max(selectedService?.duration ?? 0, selectedService2?.duration ?? 0)
    : (selectedService?.duration ?? 0)

  function updatePerson1(patch: Partial<ClientFields>) {
    setPerson1(prev => ({ ...prev, ...patch }))
  }

  function updatePerson2(patch: Partial<ClientFields>) {
    setPerson2(prev => ({ ...prev, ...patch }))
  }

  function therapistsForPerson2(): TherapistOption[] {
    if (!person1.therapistId) return therapists
    return therapists.filter(t => t.id !== person1.therapistId)
  }

  function therapistsForPerson1(): TherapistOption[] {
    if (!person2.therapistId) return therapists
    return therapists.filter(t => t.id !== person2.therapistId)
  }

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
  }, [shopId])

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true)
    try {
      const list = await fetchRooms(supabase, shopId, { activeOnly: false })
      setRooms(bookableRooms(list))
    } catch (e) {
      setRooms([])
      console.error('BookingWizard: could not load rooms', e)
    }
    setRoomsLoading(false)
  }, [shopId])

  useEffect(() => {
    if (isPublic) return
    void loadRooms()
  }, [loadRooms, isPublic])

  useEffect(() => {
    if (step === 'confirm' && !isPublic) void loadRooms()
  }, [step, loadRooms, isPublic])

  const generateSlots = useCallback(async () => {
    if (!date || !serviceId || !selectedService || (isCouple && differentServiceP2 && !serviceId2)) {
      setSlots([])
      return
    }
    if (isCouple && slotDurationMin <= 0) {
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
      const duration = isCouple ? slotDurationMin : selectedService.duration
      setSlots(
        isCouple
          ? filterAvailableCoupleSlots(date, duration, existing, ids)
          : filterAvailableSlots(date, duration, existing, ids)
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load availability')
      setSlots([])
    }
    setLoading(false)
  }, [
    date,
    shopId,
    serviceId,
    serviceId2,
    selectedService,
    therapistIds,
    isCouple,
    differentServiceP2,
    slotDurationMin,
  ])

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
    const err = validateCustomTime(
      value,
      date,
      slotDurationMin || selectedService.duration,
      dayBookings,
      therapistIds,
      isCouple
    )
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
      slotDurationMin || selectedService.duration,
      dayBookings,
      therapistIds,
      isCouple
    )
    setCustomTimeError(err ?? '')
    if (!err) {
      const normalized = normalizeHHMM(customTime)
      if (normalized) setTime(normalized)
    } else {
      setTime('')
    }
  }, [dayBookings, date, selectedService, customTime, therapistIds, isCouple, slotDurationMin])

  async function insertClient(
    name: string,
    phone: string,
    email: string
  ): Promise<string | null> {
    const { data: clientRow, error: clientErr } = await supabase
      .from('clients')
      .insert({
        shop_id: shopId,
        name: name.trim(),
        phone: phone.trim() || null,
        email: email.trim() || null,
      })
      .select('id')
      .single()
    if (!clientErr && clientRow) return clientRow.id as string
    return null
  }

  async function afterBookingSaved(
    bookingId: string,
    svc: ServiceRow,
    client: ClientFields,
    startIso: string,
    endIso: string
  ) {
    const shop = await fetchShop(shopId)
    if (shop.googleSheetSyncEnabled && shop.googleSheetUrl) {
      void syncBookingToSheet(shop.googleSheetUrl, shopId, {
        bookingId,
        date,
        time,
        service: svc.name_en,
        customer: client.name.trim(),
        phone: client.phone.trim(),
        status: 'confirmed',
      })
    }

    const email = client.email.trim()
    const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const ownerEmail = resolveShopNotificationEmail(shop)
    if (ownerEmail) {
      void sendOwnerBookingNotificationEmail({
        to: ownerEmail,
        clientName: client.name.trim(),
        clientPhone: client.phone.trim() || undefined,
        clientEmail: email || undefined,
        serviceName: svc.name_en,
        durationMin: svc.duration,
        date: dateLabel,
        time,
        therapistLabel: client.therapistName.trim() || undefined,
        shopName: shop.name,
        source: isPublic ? 'online' : 'staff',
        bookingId,
      })
    }

    if (email) {
      void sendBookingConfirmationEmail({
        to: email,
        clientName: client.name.trim(),
        serviceName: svc.name_en,
        durationMin: svc.duration,
        date: dateLabel,
        time,
        therapistLabel: client.therapistName.trim() || 'No preference',
        shopName: shop.name,
        shopAddress: shop.address,
        shopPhone: shop.phone,
      })
    }
  }

  async function saveBooking() {
    if (!selectedService || !time || !person1.name.trim()) return
    if (isCouple && !person2.name.trim()) return
    if (isCouple && differentServiceP2 && !selectedService2) return

    setLoading(true)
    setError('')

    const start = new Date(`${date}T${time}:00+10:00`)

    if (!isCouple) {
      const end = new Date(start.getTime() + selectedService.duration * 60_000)
      const staffId = person1.therapistId || null

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

      const clientId = await insertClient(person1.name, person1.phone, person1.email)

      const { data: booking, error: bookErr } = await supabase
        .from('bookings')
        .insert({
          shop_id: shopId,
          client_id: clientId,
          service_id: serviceId,
          staff_id: staffId,
          therapist_name: person1.therapistName.trim() || null,
          room_id: person1.roomId || null,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: 'confirmed',
          source: bookingSource,
          booked_by: isPublic ? undefined : bookedBy,
        })
        .select('id')
        .single()

      setLoading(false)

      if (bookErr) {
        setError(bookErr.message)
        return
      }

      if (booking) {
        setLastBookingId(booking.id)
        await afterBookingSaved(
          booking.id,
          selectedService,
          person1,
          start.toISOString(),
          end.toISOString()
        )
        onComplete?.(booking.id)
        setStep('done')
      }
      return
    }

    const svc2 = selectedService2!
    const freshBookings = await fetchDayBookings(supabase, shopId, date)
    const { slotStart, slotEnd } = slotWindow(date, time, slotDurationMin)
    const coupleCheck = evaluateCoupleSlotAvailability(
      freshBookings,
      slotStart,
      slotEnd,
      therapistIds
    )
    if (!coupleCheck.available) {
      setLoading(false)
      setError(coupleCheck.reason ?? 'Cannot book a couple at this time.')
      await generateSlots()
      setStep('datetime')
      return
    }

    const assignment = assignCoupleTherapists(
      freshBookings,
      therapists,
      slotStart,
      slotEnd,
      person1.therapistId || null,
      person2.therapistId || null
    )
    if (assignment.error || !assignment.staff1 || !assignment.staff2) {
      setLoading(false)
      setError(assignment.error ?? 'Could not assign two therapists.')
      return
    }

    const end1 = new Date(start.getTime() + selectedService.duration * 60_000)
    const end2 = new Date(start.getTime() + svc2.duration * 60_000)

    for (const [staffId, end] of [
      [assignment.staff1, end1],
      [assignment.staff2, end2],
    ] as const) {
      const { data: slotCheck } = await supabase.rpc('check_booking_slot', {
        p_shop_id: shopId,
        p_start: start.toISOString(),
        p_end: end.toISOString(),
        p_staff_id: staffId,
      })
      if (!slotCheck?.available) {
        setLoading(false)
        setError(slotCheck?.reason ?? 'This time slot is full.')
        await generateSlots()
        setStep('datetime')
        return
      }
    }

    const [clientId1, clientId2] = await Promise.all([
      insertClient(person1.name, person1.phone, person1.email),
      insertClient(person2.name, person2.phone, person2.email),
    ])

    const p1TherapistName =
      person1.therapistName.trim() || assignment.name1
    const p2TherapistName =
      person2.therapistName.trim() || assignment.name2

    const { data: bookings, error: bookErr } = await supabase
      .from('bookings')
      .insert([
        {
          shop_id: shopId,
          client_id: clientId1,
          service_id: serviceId,
          staff_id: assignment.staff1,
          therapist_name: p1TherapistName,
          room_id: person1.roomId || null,
          start_time: start.toISOString(),
          end_time: end1.toISOString(),
          status: 'confirmed',
          source: bookingSource,
          booked_by: isPublic ? undefined : bookedBy,
        },
        {
          shop_id: shopId,
          client_id: clientId2,
          service_id: differentServiceP2 ? serviceId2 : serviceId,
          staff_id: assignment.staff2,
          therapist_name: p2TherapistName,
          room_id: person2.roomId || null,
          start_time: start.toISOString(),
          end_time: end2.toISOString(),
          status: 'confirmed',
          source: bookingSource,
          booked_by: isPublic ? undefined : bookedBy,
        },
      ])
      .select('id')

    setLoading(false)

    if (bookErr) {
      setError(bookErr.message)
      return
    }

    const rows = bookings ?? []
    if (rows.length >= 2) {
      setLastBookingId(rows[0].id)
      await afterBookingSaved(rows[0].id, selectedService, {
        ...person1,
        therapistName: p1TherapistName,
      }, start.toISOString(), end1.toISOString())
      await afterBookingSaved(rows[1].id, svc2, {
        ...person2,
        therapistName: p2TherapistName,
      }, start.toISOString(), end2.toISOString())
      onComplete?.(rows[0].id)
      setStep('done')
    }
  }

  function resetWizard() {
    setStep('service')
    setBookingMode('solo')
    setDifferentServiceP2(false)
    setServiceId('')
    setServiceId2('')
    setTime('')
    setCustomTime('')
    setCustomTimeError('')
    setPerson1({
      name: '',
      phone: '',
      email: '',
      therapistId: '',
      therapistName: '',
      roomId: '',
    })
    setPerson2({
      name: '',
      phone: '',
      email: '',
      therapistId: '',
      therapistName: '',
      roomId: '',
    })
    setError('')
    setLastBookingId(null)
  }

  function canProceedFromService(): boolean {
    if (!serviceId) return false
    if (isCouple && differentServiceP2 && !serviceId2) return false
    return true
  }

  const stepIndex = STEPS.findIndex(s => s.id === step)

  return (
    <div className={`booking-wizard${isPublic ? ' booking-wizard--public' : ''}`}>
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

          {!isPublic && (
          <div className="bw-mode-toggle" role="group" aria-label="Booking type">
            <button
              type="button"
              className={`bw-mode-btn${bookingMode === 'solo' ? ' active' : ''}`}
              onClick={() => {
                setBookingMode('solo')
                setDifferentServiceP2(false)
                setServiceId2('')
                setTime('')
              }}
            >
              Just for me
            </button>
            <button
              type="button"
              className={`bw-mode-btn${bookingMode === 'couple' ? ' active' : ''}`}
              onClick={() => {
                setBookingMode('couple')
                setTime('')
              }}
            >
              For a couple
            </button>
          </div>
          )}

          {isCouple && therapists.length < 2 && (
            <p className="bw-field-error">
              Couple booking needs at least 2 active therapists on staff.
            </p>
          )}

          {services.length === 0 ? (
            <p className="bw-empty">
              {isPublic
                ? 'No services are available to book online right now. Please call us.'
                : 'No active services — add them in Services (Owner).'}
            </p>
          ) : (
            <>
              <p className="bw-label">
                {isCouple && !differentServiceP2
                  ? 'Service (both guests)'
                  : isCouple
                    ? 'Person 1 — service'
                    : 'Service'}
              </p>
              <div className="bw-service-grid">
                {services.map(svc => (
                  <button
                    key={svc.id}
                    type="button"
                    className={`bw-service-card${serviceId === svc.id ? ' selected' : ''}`}
                    onClick={() => {
                      setServiceId(svc.id)
                      if (!differentServiceP2) setServiceId2(svc.id)
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

              {isCouple && (
                <label className="bw-check-row">
                  <input
                    type="checkbox"
                    checked={differentServiceP2}
                    onChange={e => {
                      setDifferentServiceP2(e.target.checked)
                      if (!e.target.checked) {
                        setServiceId2(serviceId)
                      } else {
                        setServiceId2('')
                      }
                      setTime('')
                    }}
                  />
                  Different service for person 2
                </label>
              )}

              {isCouple && differentServiceP2 && (
                <>
                  <p className="bw-label">Person 2 — service</p>
                  <div className="bw-service-grid">
                    {services.map(svc => (
                      <button
                        key={`p2-${svc.id}`}
                        type="button"
                        className={`bw-service-card${serviceId2 === svc.id ? ' selected' : ''}`}
                        onClick={() => {
                          setServiceId2(svc.id)
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
                </>
              )}
            </>
          )}

          <button
            type="button"
            className="bw-btn primary"
            disabled={!canProceedFromService() || (isCouple && therapists.length < 2)}
            onClick={() => setStep('datetime')}
          >
            Next →
          </button>
        </div>
      )}

      {step === 'datetime' && (
        <div className="bw-step">
          <h2 className="bw-title">Date & time</h2>
          {isCouple && (
            <p className="bw-hint">
              Same appointment time for both guests — {slotDurationMin} min slot
              {selectedService && selectedService2 &&
                selectedService.id !== selectedService2.id &&
                ` (longer of ${selectedService.duration} & ${selectedService2.duration} min)`}
              .
            </p>
          )}
          {isCouple && therapists.length < 2 && (
            <p className="bw-field-error">
              Cannot continue — need 2 therapists on staff for couple booking.
            </p>
          )}
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
              {isCouple
                ? 'No couple slots on this date — need 2 therapists free at the same time. Try another day.'
                : 'No slots on this date — try another day.'}
              {therapistIds.length > 0 && !isCouple && (
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
          <h2 className="bw-title">{isPublic ? 'Your details' : 'Client information'}</h2>
          <p className="bw-hint">
            {date} at {time}
            {isCouple
              ? ` · ${selectedService?.name_en}${differentServiceP2 && selectedService2 ? ` + ${selectedService2.name_en}` : ''}`
              : ` · ${selectedService?.name_en}`}
          </p>

          <div className="bw-person-block">
            <h3 className="bw-person-title">{isCouple ? 'Person 1' : 'Guest'}</h3>
            <label className="bw-label" htmlFor="bw-therapist-1">
              Preferred therapist
            </label>
            <select
              id="bw-therapist-1"
              className="bw-input"
              value={person1.therapistId}
              onChange={e => {
                const id = e.target.value
                const t = therapists.find(x => x.id === id)
                updatePerson1({
                  therapistId: id,
                  therapistName: t?.name_en ?? '',
                })
                if (id && person2.therapistId === id) {
                  updatePerson2({ therapistId: '', therapistName: '' })
                }
              }}
            >
              <option value="">No preference</option>
              {therapistsForPerson1().map(t => (
                <option key={t.id} value={t.id}>
                  {t.name_en}
                </option>
              ))}
            </select>
            <input
              className="bw-input"
              placeholder="Full name *"
              value={person1.name}
              onChange={e => updatePerson1({ name: e.target.value })}
            />
            <input
              className="bw-input"
              placeholder="Phone"
              value={person1.phone}
              onChange={e => updatePerson1({ phone: e.target.value })}
            />
            <input
              className="bw-input"
              placeholder={isPublic ? 'Email (for confirmation) *' : 'Email'}
              type="email"
              value={person1.email}
              onChange={e => updatePerson1({ email: e.target.value })}
            />
          </div>

          {isCouple && (
            <div className="bw-person-block">
              <h3 className="bw-person-title">Person 2</h3>
              <label className="bw-label" htmlFor="bw-therapist-2">
                Preferred therapist
              </label>
              <select
                id="bw-therapist-2"
                className="bw-input"
                value={person2.therapistId}
                onChange={e => {
                  const id = e.target.value
                  const t = therapists.find(x => x.id === id)
                  updatePerson2({
                    therapistId: id,
                    therapistName: t?.name_en ?? '',
                  })
                  if (id && person1.therapistId === id) {
                    updatePerson1({ therapistId: '', therapistName: '' })
                  }
                }}
              >
                <option value="">No preference</option>
                {therapistsForPerson2().map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name_en}
                  </option>
                ))}
              </select>
              <input
                className="bw-input"
                placeholder="Full name *"
                value={person2.name}
                onChange={e => updatePerson2({ name: e.target.value })}
              />
              <input
                className="bw-input"
                placeholder="Phone"
                value={person2.phone}
                onChange={e => updatePerson2({ phone: e.target.value })}
              />
              <input
                className="bw-input"
                placeholder="Email"
                type="email"
                value={person2.email}
                onChange={e => updatePerson2({ email: e.target.value })}
              />
            </div>
          )}

          <div className="bw-nav">
            <button type="button" className="bw-btn secondary" onClick={() => setStep('datetime')}>
              ← Back
            </button>
            <button
              type="button"
              className="bw-btn primary"
              disabled={
                !person1.name.trim() ||
                (isCouple && !person2.name.trim()) ||
                (isPublic && !person1.email.trim())
              }
              onClick={() => setStep('confirm')}
            >
              Review →
            </button>
          </div>
        </div>
      )}

      {step === 'confirm' && (
        <div className="bw-step">
          <h2 className="bw-title">
            {isCouple ? 'Confirm couple booking' : isPublic ? 'Confirm your booking' : 'Confirm booking'}
          </h2>

          <div className="bw-summary bw-summary-when">
            <div className="bw-summary-row">
              <span>When</span>
              <strong>
                {date} {time}
              </strong>
            </div>
          </div>

          <div className="bw-person-block">
            <h3 className="bw-person-title">{isCouple ? 'Person 1' : 'Guest'}</h3>
            {!isPublic && (
            <>
            <label className="bw-label" htmlFor="bw-room-1">
              Room (optional)
            </label>
            <select
              id="bw-room-1"
              className="bw-input"
              value={person1.roomId}
              disabled={roomsLoading}
              onChange={e => updatePerson1({ roomId: e.target.value })}
            >
              <option value="">— Unassigned —</option>
              {rooms.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            </>
            )}
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
                <span>Client</span>
                <strong>{person1.name}</strong>
              </div>
              <div className="bw-summary-row">
                <span>Therapist</span>
                <strong>{person1.therapistName || 'No preference'}</strong>
              </div>
              {!isPublic && (
              <div className="bw-summary-row">
                <span>Room</span>
                <strong>
                  {person1.roomId
                    ? rooms.find(r => r.id === person1.roomId)?.name ?? '— Unassigned —'
                    : '— Unassigned —'}
                </strong>
              </div>
              )}
              {person1.phone && (
                <div className="bw-summary-row">
                  <span>Phone</span>
                  <strong>{person1.phone}</strong>
                </div>
              )}
            </div>
          </div>

          {isCouple && selectedService2 && (
            <div className="bw-person-block">
              <h3 className="bw-person-title">Person 2</h3>
              <label className="bw-label" htmlFor="bw-room-2">
                Room (optional)
              </label>
              <select
                id="bw-room-2"
                className="bw-input"
                value={person2.roomId}
                disabled={roomsLoading}
                onChange={e => updatePerson2({ roomId: e.target.value })}
              >
                <option value="">— Unassigned —</option>
                {rooms.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <div className="bw-summary">
                <div className="bw-summary-row">
                  <span>Service</span>
                  <strong>{selectedService2.name_en}</strong>
                </div>
                <div className="bw-summary-row">
                  <span>Duration</span>
                  <strong>{selectedService2.duration} min</strong>
                </div>
                <div className="bw-summary-row">
                  <span>Price</span>
                  <strong>${Number(selectedService2.price).toFixed(2)}</strong>
                </div>
                <div className="bw-summary-row">
                  <span>Client</span>
                  <strong>{person2.name}</strong>
                </div>
                <div className="bw-summary-row">
                  <span>Therapist</span>
                  <strong>{person2.therapistName || 'No preference'}</strong>
                </div>
                <div className="bw-summary-row">
                  <span>Room</span>
                  <strong>
                    {person2.roomId
                      ? rooms.find(r => r.id === person2.roomId)?.name ?? '— Unassigned —'
                      : '— Unassigned —'}
                  </strong>
                </div>
                {person2.phone && (
                  <div className="bw-summary-row">
                    <span>Phone</span>
                    <strong>{person2.phone}</strong>
                  </div>
                )}
              </div>
            </div>
          )}

          {roomsLoading && !isPublic && (
            <p className="bw-hint">Loading rooms…</p>
          )}
          {!isPublic && !roomsLoading && rooms.length === 0 && (
            <p className="bw-hint">No rooms yet — add them in Owner → Rooms.</p>
          )}

          {isCouple && (
            <p className="bw-hint bw-total-hint">
              Total: $
              {(
                Number(selectedService?.price ?? 0) +
                Number(
                  differentServiceP2
                    ? selectedService2?.price ?? 0
                    : selectedService?.price ?? 0
                )
              ).toFixed(2)}
            </p>
          )}

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
              {loading
                ? 'Saving…'
                : isCouple
                  ? 'Confirm 2 bookings'
                  : 'Confirm booking'}
            </button>
          </div>
        </div>
      )}

      {step === 'done' && (
        <div className="bw-step bw-done">
          <div className="bw-done-icon">✓</div>
          <h2>{isCouple ? 'Couple booking confirmed' : 'Booking confirmed'}</h2>
          <p>
            {person1.name}
            {isCouple && ` & ${person2.name}`} — {date} at {time}
          </p>
          <p className="bw-hint">
            Therapist{isCouple ? 's' : ''}:{' '}
            {isCouple
              ? `${person1.therapistName || 'No preference'} · ${person2.therapistName || 'No preference'}`
              : person1.therapistName || 'Any available therapist'}
          </p>
          {lastBookingId && (
            <p className="bw-booking-ref">
              Booking reference: <strong>{lastBookingId}</strong>
            </p>
          )}
          {isPublic && person1.email.trim() && (
            <p className="bw-hint">
              A confirmation email has been sent to {person1.email.trim()}.
            </p>
          )}
          <button type="button" className="bw-btn primary" onClick={resetWizard}>
            {isPublic ? 'Book another appointment' : 'Book another'}
          </button>
        </div>
      )}
    </div>
  )
}
