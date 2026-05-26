import { useMemo, useState } from 'react'
import Trip2TalkLogo from '../components/Trip2TalkLogo'
import { supabase } from '../lib/supabase'
import './TripBookPage.css'

type Step = 1 | 2 | 3

type TripOption = {
  id: string
  icon: string
  name: string
  duration: string
  price: string
  maxPax: string
}

const BOOK_TRIPS: TripOption[] = [
  { id: 'melbourne', icon: '🏙️', name: 'Melbourne Road Trip', duration: '4 วัน 3 คืน', price: '$1,302/คน', maxPax: 'รับ 4-5 ท่าน' },
  { id: 'tasmania', icon: '🌌', name: 'Aurora Tasmania', duration: '4 วัน 3 คืน', price: '$1,302/คน', maxPax: 'รับ 4-5 ท่าน' },
  { id: 'uluru', icon: '🪨', name: 'Uluru–Kata Tjuta', duration: '3 คืน 4 วัน', price: '$1,990/คน', maxPax: 'รับ 4-5 ท่าน' },
  { id: 'nz', icon: '🏔️', name: 'NZ South Island', duration: '6 วัน', price: '$2,300/คน', maxPax: 'รับ 4-5 ท่าน' },
  { id: 'annabay', icon: '🏖️', name: 'Anna Bay (1 Day)', duration: '1 วัน', price: '$250/คน', maxPax: 'รับ 4 ท่าน' },
  { id: 'bluemountains', icon: '🌸', name: 'Blue Mountains Lavender (1 Day)', duration: '1 วัน', price: '$250/คน', maxPax: 'รับ 4 ท่าน' },
  { id: 'oberon', icon: '❄️', name: 'Oberon Snow (1 Day)', duration: '1 วัน', price: '$250/คน', maxPax: 'รับ 4 ท่าน' },
  { id: 'helensburghkiama', icon: '🌊', name: 'Helensburgh–Kiama (1 Day)', duration: '1 วัน', price: '$250/คน', maxPax: 'รับ 4 ท่าน' },
]

const REFERRAL_OPTIONS = ['Facebook พี่แสน', 'แชร์จากเพื่อน', 'อื่นๆ'] as const

const PAYID = '0452044382'

function tripShortLabel(id: string): string {
  const t = BOOK_TRIPS.find((x) => x.id === id)
  if (!t) return id
  return t.name.split('(')[0]?.trim() ?? t.name
}

export default function TripBookPage() {
  const [step, setStep] = useState<Step>(1)
  const [tripId, setTripId] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [numPeople, setNumPeople] = useState(1)
  const [specialRequests, setSpecialRequests] = useState('')
  const [referral, setReferral] = useState<string>(REFERRAL_OPTIONS[0])
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedTrip = useMemo(() => BOOK_TRIPS.find((t) => t.id === tripId) ?? null, [tripId])

  const payRef = useMemo(() => {
    const first = fullName.trim().split(/\s+/)[0] ?? 'Guest'
    const trip = tripShortLabel(tripId ?? '')
    return `${first} ${trip}`.trim()
  }, [fullName, tripId])

  const copyPayId = async () => {
    try {
      await navigator.clipboard.writeText(PAYID)
    } catch {
      window.prompt('Copy PayID:', PAYID)
    }
  }

  const submitBooking = async () => {
    if (!tripId || !fullName.trim() || !phone.trim()) {
      setError('กรุณากรอกข้อมูลให้ครบ')
      return
    }
    if (!slipFile) {
      setError('กรุณาอัปโหลดสลิป')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const ext = slipFile.name.split('.').pop() ?? 'jpg'
      const path = `${Date.now()}-${phone.replace(/\D/g, '').slice(-8)}.${ext}`
      const { error: upErr } = await supabase.storage.from('booking-slips').upload(path, slipFile, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('booking-slips').getPublicUrl(path)
      const { error: insErr } = await supabase.from('trip_bookings').insert({
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || null,
        trip_type: tripId,
        num_people: numPeople,
        special_requests: specialRequests.trim() || null,
        referral_source: referral,
        slip_url: pub.publicUrl,
        status: 'pending',
      })
      if (insErr) throw insErr
      setDone(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งข้อมูลไม่สำเร็จ')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="trip-book client-neon">
        <div className="trip-book__success">
          {`✅ ได้รับข้อมูลแล้วครับ!\nพี่แสนจะติดต่อกลับภายใน 24 ชั่วโมง\n📱 LINE/Tel: 0452044382`}
        </div>
      </div>
    )
  }

  return (
    <div className="trip-book client-neon">
      <div className="trip-book__steps" aria-label="ขั้นตอน">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={`trip-book__dot ${step === n ? 'is-active' : ''} ${step > n ? 'is-done' : ''}`}
          />
        ))}
      </div>

      {step === 1 && (
        <div className="trip-book__panel" key="s1">
          <div className="trip-book__brand">
            <Trip2TalkLogo size="nav" />
          </div>
          <h1 className="trip-book__title">จองทริปกับพี่แสน</h1>
          <p className="trip-book__sub">ช่างภาพพาไป · ขับรถเอง · ถ่ายรูปให้</p>
          {BOOK_TRIPS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={`trip-book__card ${tripId === t.id ? 'is-selected' : ''}`}
              onClick={() => setTripId(t.id)}
            >
              <div className="trip-book__cardhead">
                <span className="trip-book__icon" aria-hidden>
                  {t.icon}
                </span>
                <div>
                  <p className="trip-book__name">{t.name}</p>
                  <p className="trip-book__meta">
                    {t.duration} — {t.price}
                  </p>
                  <span className="trip-book__badge">{t.maxPax}</span>
                </div>
              </div>
            </button>
          ))}
          <button
            type="button"
            className="trip-book__cta"
            disabled={!tripId}
            onClick={() => setStep(2)}
          >
            ถัดไป
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="trip-book__panel" key="s2">
          <h2 className="trip-book__title">กรอกข้อมูล</h2>
          {selectedTrip && (
            <p className="trip-book__sub">
              {selectedTrip.icon} {selectedTrip.name}
            </p>
          )}
          <label className="trip-book__field">
            <span className="trip-book__label">ชื่อ-นามสกุล *</span>
            <input
              className="trip-book__input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label className="trip-book__field">
            <span className="trip-book__label">เบอร์โทร *</span>
            <input
              className="trip-book__input"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </label>
          <label className="trip-book__field">
            <span className="trip-book__label">อีเมล</span>
            <input
              className="trip-book__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="trip-book__field">
            <span className="trip-book__label">จำนวนคน</span>
            <div className="trip-book__stepper">
              <button type="button" onClick={() => setNumPeople((n) => Math.max(1, n - 1))} aria-label="ลด">
                −
              </button>
              <span>{numPeople}</span>
              <button type="button" onClick={() => setNumPeople((n) => Math.min(5, n + 1))} aria-label="เพิ่ม">
                +
              </button>
            </div>
          </label>
          <label className="trip-book__field">
            <span className="trip-book__label">โน้ตพิเศษ / ข้อมูลสุขภาพ</span>
            <textarea
              className="trip-book__textarea"
              value={specialRequests}
              onChange={(e) => setSpecialRequests(e.target.value)}
            />
          </label>
          <label className="trip-book__field">
            <span className="trip-book__label">รู้จักเราจากไหน?</span>
            <select className="trip-book__select" value={referral} onChange={(e) => setReferral(e.target.value)}>
              {REFERRAL_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="trip-book__cta" onClick={() => setStep(3)}>
            ถัดไป
          </button>
          <button type="button" className="trip-book__cta trip-book__cta--ghost" onClick={() => setStep(1)}>
            ย้อนกลับ
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="trip-book__panel" key="s3">
          <h2 className="trip-book__title">ชำระมัดจำ</h2>
          <div className="trip-book__paycard">
            <p>
              <strong>💳 ชำระมัดจำ $100 AUD</strong>
            </p>
            <p>PayID: {PAYID}</p>
            <p>ชื่อ: Saard Saenmuang</p>
            <p>ธนาคาร: NAB Bank</p>
            <p>
              📌 อ้างอิง: <strong>{payRef}</strong>
            </p>
            <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>เช่น &quot;สมชาย Melbourne&quot;</p>
            <button type="button" className="trip-book__cta" style={{ marginTop: 12 }} onClick={() => void copyPayId()}>
              📋 Copy PayID
            </button>
          </div>

          <div className="trip-book__slip">
            <p className="trip-book__label">อัปโหลดสลิปหลังโอนเงิน</p>
            <input
              id="slip-upload"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
            />
            <label htmlFor="slip-upload">{slipFile ? slipFile.name : 'เลือกรูปสลิป'}</label>
          </div>

          {error && <p style={{ color: '#e88', fontSize: '0.85rem', marginTop: 8 }}>{error}</p>}

          <button
            type="button"
            className="trip-book__cta"
            disabled={submitting}
            onClick={() => void submitBooking()}
          >
            {submitting ? 'กำลังส่ง…' : 'ยืนยันการจอง'}
          </button>
          <button type="button" className="trip-book__cta trip-book__cta--ghost" onClick={() => setStep(2)}>
            ย้อนกลับ
          </button>
        </div>
      )}
    </div>
  )
}
