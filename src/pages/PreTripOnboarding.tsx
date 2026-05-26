import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import QRCode from 'react-qr-code'
import { supabase } from '../lib/supabase'
import { WAIVER_TEXT } from '../lib/compliance'
import { dispatchTransactionNotification } from '../lib/notifications'
import { buildTrip2TalkOnboardUrl } from '../lib/trip2talkAppUrl'
import { setStoredClientId } from '../hooks/useClientSession'
import type { OnboardingFormState } from '../types/missing_tables'
import { filterAllowedTours, isGoldCoastTour } from '../lib/tripFilters'
import type { Tour, TourDestination, VisaStatus } from '../types/tour'
import Trip2TalkShell, { T2Button, T2Card } from '../components/trip2talk/Trip2TalkShell'

const STEPS = 5
const VISA_OPTIONS: VisaStatus[] = [
  'NOT_REQUIRED',
  'SUBMITTED',
  'APPROVED',
  'REJECTED',
  'PENDING_NZ_VISA',
]

const EMPTY_FORM: OnboardingFormState = {
  first_name_th: '',
  last_name_th: '',
  first_name_en: '',
  last_name_en: '',
  passport_number: '',
  visa_status: 'PENDING_NZ_VISA',
  oshc_provider: '',
  oshc_policy_number: '',
  oshc_expiry: '',
  medical_conditions: '',
  dietary_requirements: '',
  phone: '',
  email: '',
  facebook_profile_url: '',
  signature: '',
  agreed_terms: false,
  agreed_risk: false,
  agreed_medical: false,
  agreed_media: false,
  agreed_privacy: false,
}

function StaffQrPanel({
  tours,
  selectedTripCode,
  onSelectTripCode,
}: {
  tours: Tour[]
  selectedTripCode: string
  onSelectTripCode: (code: string) => void
}) {
  const onboardUrl = selectedTripCode ? buildTrip2TalkOnboardUrl(selectedTripCode) : ''

  return (
    <T2Card className="mb-4 border-amber-500/30">
      <p className="text-xs font-medium uppercase tracking-wide text-amber-400">Staff QR panel</p>
      <label className="mt-3 block text-sm text-neutral-400">
        Confirmed tour
        <select
          value={selectedTripCode}
          onChange={(e) => onSelectTripCode(e.target.value)}
          className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
        >
          <option value="">Select trip…</option>
          {tours.map((t) => (
            <option key={t.id} value={t.trip_code}>
              {t.trip_code} — {t.destination} ({t.start_date})
            </option>
          ))}
        </select>
      </label>
      {onboardUrl ? (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="rounded-xl bg-white p-3">
            <QRCode value={onboardUrl} size={160} />
          </div>
          <p className="break-all text-center font-mono text-xs text-neutral-500">{onboardUrl}</p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">Select a tour to generate the onboarding QR.</p>
      )}
    </T2Card>
  )
}

function SignaturePad({
  value,
  onChange,
}: {
  value: string
  onChange: (sig: string) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)

  const exportCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const blank = document.createElement('canvas')
    blank.width = canvas.width
    blank.height = canvas.height
    if (canvas.toDataURL() === blank.toDataURL()) return
    onChange(canvas.toDataURL('image/png'))
  }, [onChange])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
  }, [])

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function startDraw(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = pointerPos(e)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function endDraw() {
    if (!drawing.current) return
    drawing.current = false
    exportCanvas()
  }

  function clear() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    onChange('')
  }

  return (
    <div className="space-y-3">
      <canvas
        ref={canvasRef}
        className="h-36 w-full touch-none rounded-xl border border-neutral-700 bg-neutral-950"
        onPointerDown={startDraw}
        onPointerMove={draw}
        onPointerUp={endDraw}
        onPointerLeave={endDraw}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={clear}
          className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 transition active:scale-95"
        >
          Clear pad
        </button>
      </div>
      <label className="block text-sm text-neutral-400">
        Or type full legal name as signature
        <input
          type="text"
          value={value.startsWith('data:') ? '' : value}
          onChange={(e) => onChange(e.target.value.trim())}
          placeholder="Full name"
          className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100"
        />
      </label>
    </div>
  )
}

export default function PreTripOnboarding() {
  const [searchParams] = useSearchParams()
  const tripParam = searchParams.get('trip') ?? ''
  const staffMode =
    searchParams.get('staff') === '1' || searchParams.get('mode') === 'staff'

  const [step, setStep] = useState(1)
  const [form, setForm] = useState<OnboardingFormState>(EMPTY_FORM)
  const [tours, setTours] = useState<Tour[]>([])
  const [tour, setTour] = useState<Tour | null>(null)
  const [tripCode, setTripCode] = useState(tripParam)
  const [toursLoading, setToursLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const patch = (partial: Partial<OnboardingFormState>) =>
    setForm((f) => ({ ...f, ...partial }))

  useEffect(() => {
    let cancelled = false
    async function loadTours() {
      setToursLoading(true)
      const { data, error } = await supabase
        .from('tours')
        .select('*')
        .eq('status', 'CONFIRMED')
        .order('start_date', { ascending: true })
      if (!cancelled) {
        if (!error) setTours(filterAllowedTours((data ?? []) as Tour[]))
        setToursLoading(false)
      }
    }
    void loadTours()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!tripCode) {
      setTour(null)
      return
    }
    const found = tours.find((t) => t.trip_code === tripCode)
    if (found) setTour(found)
    else if (!toursLoading && tripCode) {
      void supabase
        .from('tours')
        .select('*')
        .eq('trip_code', tripCode)
        .maybeSingle()
        .then(({ data }) => {
          const t = data as Tour | null
          setTour(t && !isGoldCoastTour(t) ? t : null)
        })
    }
  }, [tripCode, tours, toursLoading])

  const waiverComplete =
    form.agreed_terms &&
    form.agreed_risk &&
    form.agreed_medical &&
    form.agreed_media &&
    form.agreed_privacy &&
    form.signature.trim().length > 0

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())

  const contactComplete = emailValid

  const personalComplete =
    contactComplete &&
    form.first_name_th.trim() &&
    form.last_name_th.trim() &&
    form.first_name_en.trim() &&
    form.last_name_en.trim()

  const complianceComplete =
    form.passport_number.trim() && form.oshc_expiry.trim()

  async function handleSubmit() {
    if (!waiverComplete || !personalComplete || !complianceComplete) {
      setSubmitError('Please complete all required fields and agreements.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const { data: clientRow, error: clientErr } = await supabase
        .from('crm_clients')
        .insert({
          first_name_th: form.first_name_th.trim(),
          last_name_th: form.last_name_th.trim(),
          first_name_en: form.first_name_en.trim(),
          last_name_en: form.last_name_en.trim(),
          passport_number: form.passport_number.trim(),
          visa_status: form.visa_status,
          oshc_provider: form.oshc_provider.trim() || null,
          oshc_policy_number: form.oshc_policy_number.trim() || null,
          oshc_expiry: form.oshc_expiry,
          medical_conditions: form.medical_conditions.trim() || null,
          dietary_requirements: form.dietary_requirements.trim() || null,
          phone: form.phone.trim() || null,
          client_email: form.email.trim(),
          facebook_profile_url: form.facebook_profile_url.trim() || null,
          client_tier: 'STANDARD',
        })
        .select('id')
        .single()

      if (clientErr || !clientRow?.id) {
        throw new Error(clientErr?.message ?? 'Could not save client profile')
      }

      const clientId = clientRow.id as string
      const signedAt = new Date().toISOString()

      const { error: waiverErr } = await supabase.from('waivers').insert({
        client_id: clientId,
        agreed_terms: form.agreed_terms,
        agreed_risk: form.agreed_risk,
        agreed_medical: form.agreed_medical,
        agreed_media: form.agreed_media,
        agreed_privacy: form.agreed_privacy,
        digital_signature: form.signature.trim(),
        signed_at: signedAt,
      })

      if (waiverErr) throw new Error(waiverErr.message)

      if (tour) {
        await supabase.from('tour_bookings').insert({
          tour_id: tour.id,
          client_id: clientId,
          booking_status: 'PENDING',
          amount_paid_aud: 0,
        })
      }

      const clientName = `${form.first_name_en} ${form.last_name_en}`.trim()
      await dispatchTransactionNotification({
        client_name: clientName,
        client_email: form.email.trim() || undefined,
        client_phone: form.phone.trim() || undefined,
        trip_code: tour?.trip_code ?? (tripCode || 'ONBOARD'),
        booking_status: 'onboarding_complete',
        payment_method: 'onboarding',
      })

      setStoredClientId(clientId)
      setStep(5)
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  function nextStep() {
    if (step === 1 && !contactComplete) {
      setSubmitError('A valid email is required for your payment receipt.')
      return
    }
    if (step === 2 && !personalComplete) {
      setSubmitError('Please fill in all name fields (TH & EN).')
      return
    }
    if (step === 3 && !complianceComplete) {
      setSubmitError('Passport number and OSHC expiry are required.')
      return
    }
    if (step === 4) {
      void handleSubmit()
      return
    }
    setSubmitError(null)
    setStep((s) => Math.min(STEPS, s + 1))
  }

  function prevStep() {
    setSubmitError(null)
    setStep((s) => Math.max(1, s - 1))
  }

  return (
    <Trip2TalkShell className="pb-8">
      <div className="px-4 pt-6">
        {staffMode && (
          <StaffQrPanel
            tours={tours}
            selectedTripCode={tripCode}
            onSelectTripCode={setTripCode}
          />
        )}

        {!staffMode && tour && (
          <p className="mb-4 text-center text-sm text-amber-400">
            Trip <span className="font-mono">{tour.trip_code}</span> · {tour.destination}
          </p>
        )}

        <div className="mb-6 flex justify-center gap-2">
          {Array.from({ length: STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full ${
                i + 1 <= step ? 'bg-amber-400' : 'bg-neutral-800'
              }`}
            />
          ))}
        </div>

        {step === 1 && (
          <T2Card className="space-y-4">
            <h1 className="text-xl font-semibold text-amber-400">Welcome to Trip2Talk</h1>
            <p className="text-neutral-300">
              ยินดีต้อนรับ — complete pre-trip registration before departure.
            </p>
            <p className="text-sm text-neutral-500">
              ~5 minutes · passport, OSHC, visa & liability waiver
            </p>
            {!staffMode && !tripCode && (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
                Scan your tour QR or open the link from your guide to attach this form to a trip.
              </p>
            )}
            <Field
              label="Email (required) · สำหรับใบเสร็จ"
              value={form.email}
              onChange={(v) => patch({ email: v })}
              type="email"
              required
            />
            <Field
              label="Facebook profile URL (optional) · สำหรับทีมงานอ้างอิง"
              value={form.facebook_profile_url}
              onChange={(v) => patch({ facebook_profile_url: v })}
              type="url"
              placeholder="https://facebook.com/..."
            />
          </T2Card>
        )}

        {step === 2 && (
          <T2Card className="space-y-4">
            <h2 className="text-lg font-semibold">Personal details · ข้อมูลส่วนตัว</h2>
            <div className="grid grid-cols-2 gap-3">
              <Field label="ชื่อ (TH)" value={form.first_name_th} onChange={(v) => patch({ first_name_th: v })} />
              <Field label="นามสกุล (TH)" value={form.last_name_th} onChange={(v) => patch({ last_name_th: v })} />
              <Field label="First name (EN)" value={form.first_name_en} onChange={(v) => patch({ first_name_en: v })} />
              <Field label="Last name (EN)" value={form.last_name_en} onChange={(v) => patch({ last_name_en: v })} />
            </div>
            <Field label="Phone · เบอร์โทร" value={form.phone} onChange={(v) => patch({ phone: v })} type="tel" />
          </T2Card>
        )}

        {step === 3 && (
          <T2Card className="space-y-4">
            <h2 className="text-lg font-semibold">OSHC & visa · วีซ่าและประกัน</h2>
            <Field
              label="Passport no."
              value={form.passport_number}
              onChange={(v) => patch({ passport_number: v })}
            />
            <label className="block text-sm text-neutral-400">
              Visa status
              <select
                value={form.visa_status}
                onChange={(e) => patch({ visa_status: e.target.value as VisaStatus })}
                className="mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2"
              >
                {VISA_OPTIONS.map((v) => (
                  <option key={v} value={v}>
                    {v.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </label>
            <Field label="OSHC provider" value={form.oshc_provider} onChange={(v) => patch({ oshc_provider: v })} />
            <Field
              label="Policy number"
              value={form.oshc_policy_number}
              onChange={(v) => patch({ oshc_policy_number: v })}
            />
            <Field
              label="OSHC expiry"
              value={form.oshc_expiry}
              onChange={(v) => patch({ oshc_expiry: v })}
              type="date"
            />
            <Field
              label="Medical conditions (optional)"
              value={form.medical_conditions}
              onChange={(v) => patch({ medical_conditions: v })}
              multiline
            />
            <Field
              label="Dietary requirements (optional)"
              value={form.dietary_requirements}
              onChange={(v) => patch({ dietary_requirements: v })}
              multiline
            />
          </T2Card>
        )}

        {step === 4 && (
          <T2Card className="space-y-4">
            <h2 className="text-lg font-semibold">Waiver & signature</h2>
            <div className="max-h-48 space-y-2 overflow-y-auto rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-xs text-neutral-400">
              <p className="font-medium text-neutral-200">{WAIVER_TEXT.EN.title}</p>
              <p>{WAIVER_TEXT.EN.terms}</p>
              <p>{WAIVER_TEXT.EN.risk}</p>
              <p className="mt-2 font-medium text-neutral-200">{WAIVER_TEXT.TH.title}</p>
              <p>{WAIVER_TEXT.TH.terms}</p>
            </div>
            {(
              [
                ['agreed_terms', WAIVER_TEXT.EN.terms, 'terms'],
                ['agreed_risk', WAIVER_TEXT.EN.risk, 'risk'],
                ['agreed_medical', WAIVER_TEXT.EN.medical, 'medical'],
                ['agreed_media', WAIVER_TEXT.EN.media, 'media'],
                ['agreed_privacy', WAIVER_TEXT.EN.privacy, 'privacy'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={form[key]}
                  onChange={(e) => patch({ [key]: e.target.checked })}
                  className="mt-1 accent-amber-400"
                />
                <span className="text-neutral-300">{label}</span>
              </label>
            ))}
            <SignaturePad value={form.signature} onChange={(sig) => patch({ signature: sig })} />
          </T2Card>
        )}

        {step === 5 && (
          <T2Card className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-amber-400/20 text-3xl text-amber-400">
              ✓
            </div>
            <h2 className="text-xl font-semibold text-amber-400">Registration complete</h2>
            <p className="mt-2 text-neutral-400">ลงทะเบียนเรียบร้อยแล้ว</p>
            <p className="mt-4 text-sm text-neutral-500">
              Open the Trip Guide app for destination content, packing lists & itinerary.
            </p>
            <a
              href="/"
              className="mt-6 inline-block w-full rounded-xl bg-amber-500 py-3 font-medium text-neutral-950 transition active:scale-95"
            >
              Open Trip Guide
            </a>
          </T2Card>
        )}

        {submitError && (
          <p className="mt-4 rounded-xl border border-red-800 bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {submitError}
          </p>
        )}

        {step < 5 && (
          <div className="mt-6 flex gap-3">
            {step > 1 && (
              <T2Button variant="ghost" onClick={prevStep} className="!w-auto flex-1">
                Back
              </T2Button>
            )}
            <T2Button
              onClick={nextStep}
              disabled={submitting || (step === 4 && !waiverComplete)}
              className="flex-1"
            >
              {submitting ? 'Saving…' : step === 4 ? 'Submit & finish' : 'Continue'}
            </T2Button>
          </div>
        )}

        {toursLoading && staffMode && (
          <p className="mt-2 text-center text-xs text-neutral-600">Loading confirmed tours…</p>
        )}
      </div>
    </Trip2TalkShell>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  multiline,
  required,
  placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  multiline?: boolean
  required?: boolean
  placeholder?: string
}) {
  const cls =
    'mt-1 w-full rounded-xl border border-neutral-700 bg-neutral-950 px-3 py-2 text-neutral-100'
  return (
    <label className="block text-sm text-neutral-400">
      {label}
      {multiline ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className={cls} />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cls}
          required={required}
          placeholder={placeholder}
        />
      )}
    </label>
  )
}
