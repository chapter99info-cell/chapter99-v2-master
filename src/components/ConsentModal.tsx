import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/** Google Apps Script Web App — records consent rows */
export const CONSENT_SHEET_URL =
  'https://script.google.com/macros/s/AKfycbwT9nbzRvuDMVo9TzlnpRmIae-qMAV9bThMClCx-8Ap7vxSyZhmpqQA2Wzd7NmHmR3M/exec'

export const CONSENT_STORAGE_KEY = 't2t_consent_given'

export function hasTripConsent(): boolean {
  try {
    return localStorage.getItem(CONSENT_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

type ConsentModalProps = {
  tripId?: string | null
  onAccepted: () => void
}

const CONSENT_SECTIONS: { title: string; body: string }[] = [
  {
    title: '1. ความเสี่ยงส่วนตัวและอุบัติเหตุระหว่างทริป',
    body:
      'การเดินทางอาจมีความเสี่ยงจากสภาพถนน สภาพอากาศ กิจกรรมกลางแจ้ง หรือสุขภาพส่วนบุคคล ผู้เข้าร่วมตกลงรับผิดชอบตนเองและปฏิบัติตามคำแนะนำด้านความปลอดภัยของ Trip2Talk และ Trip Leader อย่างเคร่งครัด',
  },
  {
    title: '2. การถ่ายภาพและการใช้รูปในสื่อโซเชียลของ Trip2Talk',
    body:
      'ระหว่างทริปอาจมีการถ่ายภาพและวิดีโอเพื่อบันทึกความทรงจำและโปรโมตบริการ Trip2Talk ผู้เข้าร่วมยินยอมให้ Trip2Talk ใช้ภาพหรือวิดีโอที่มีตนเองปรากฏในสื่อโซเชียล เว็บไซต์ หรือสื่อส่งเสริมการขาย โดยไม่เรียกเก็บค่าตอบแทนเพิ่มเติม เว้นแต่จะแจ้งเป็นลายลักษณ์อักษรเป็นอย่างอื่น',
  },
  {
    title: '3. นโยบายการยกเลิกและคืนเงิน',
    body:
      'การยกเลิกหรือเลื่อนทริปเป็นไปตามเงื่อนไขที่แจ้งตอนจอง มัดจำหรือค่าทริปอาจไม่คืนในบางกรณี เช่น ยกเลิกใกล้วันเดินทาง หรือเหตุส่วนตัวของผู้เข้าร่วม รายละเอียดคืนเงินจะแจ้งเป็นลายลักษณ์อักษรก่อนชำระเงิน',
  },
  {
    title: '4. ข้อมูลส่วนตัว (PDPA)',
    body:
      'Trip2Talk เก็บและใช้ข้อมูลส่วนบุคคล เช่น ชื่อ-นามสกุล เบอร์โทร อีเมล ข้อมูลสุขภาพที่จำเป็น และข้อมูลการจอง เพื่อจัดทริป ติดต่อสื่อสาร และปฏิบัติตามกฎหมาย ข้อมูลจะไม่เปิดเผยต่อบุคคลที่สามโดยไม่จำเป็น ยกเว้นตามที่กฎหมายกำหนด',
  },
  {
    title: '5. สภาพอากาศและเหตุสุดวิสัยที่อาจเปลี่ยนแปลงโปรแกรม',
    body:
      'โปรแกรมทริปอาจเปลี่ยนแปลงจากสภาพอากาศ การปิดพื้นที่ หรือเหตุสุดวิสัยที่ควบคุมไม่ได้ Trip2Talk และ Trip Leader จะพยายามจัดทางเลือกที่เหมาะสมที่สุด แต่ไม่รับประกันว่าจะครบทุกจุดตามแผนเดิม',
  },
  {
    title: '6. การปฏิบัติตามคำแนะนำของ Trip Leader เพื่อความปลอดภัย',
    body:
      'เพื่อความปลอดภัยของทุกคน ผู้เข้าร่วมตกลงปฏิบัติตามคำแนะนำของ Trip Leader เรื่องเวลา จุดนัดพบ อุปกรณ์ความปลอดภัย และกฎในพื้นที่ท่องเที่ยว การไม่ปฏิบัติตามอาจถูกขอให้ออกจากกิจกรรมโดยไม่คืนเงินส่วนที่เหลือ',
  },
  {
    title: '7. การประกันภัยส่วนตัว',
    body:
      'การประกันภัยการเดินทางหรือประกันสุขภาพเป็นความรับผิดชอบของผู้เข้าร่วมเอง Trip2Talk แนะนำให้มีความคุ้มครองที่ครอบคลุมการเดินทาง กิจกรรมผจญภัย (ถ้ามี) และค่ารักษาพยาบาลในต่างประเทศ',
  },
]

async function postConsentRecord(payload: {
  name: string
  timestamp: string
  userAgent: string
  tripId: string | null
}) {
  try {
    await fetch(CONSENT_SHEET_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.warn('[Consent] Sheet POST failed (consent still saved locally):', err)
  }
}

export default function ConsentModal({ tripId: tripIdProp, onAccepted }: ConsentModalProps) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [name, setName] = useState('')
  const [scrolledToEnd, setScrolledToEnd] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const tripId = tripIdProp ?? searchParams.get('tripId') ?? searchParams.get('tourId') ?? null

  const checkScrollEnd = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 12
    setScrolledToEnd(atBottom)
  }, [])

  useEffect(() => {
    checkScrollEnd()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => checkScrollEnd())
    ro.observe(el)
    return () => ro.disconnect()
  }, [checkScrollEnd])

  const nameOk = name.trim().length >= 2
  const canConsent = nameOk && scrolledToEnd && !submitting

  const handleAccept = async () => {
    if (!canConsent) return
    setSubmitting(true)
    const trimmed = name.trim()
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, 'true')
    } catch {
      /* private mode */
    }
    void postConsentRecord({
      name: trimmed,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      tripId,
    })
    setSubmitting(false)
    onAccepted()
  }

  const handleDecline = () => {
    navigate('/', { replace: true })
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="t2t-consent-title"
    >
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" aria-hidden />

      <div
        className="relative z-[201] flex w-full max-w-[600px] max-h-[min(92vh,720px)] flex-col rounded-2xl border shadow-2xl"
        style={{
          borderColor: 'rgba(245, 197, 24, 0.35)',
          background: '#1a1a1a',
          color: '#f5f0e8',
        }}
      >
        <header className="shrink-0 border-b px-5 py-4" style={{ borderColor: 'rgba(245, 197, 24, 0.2)' }}>
          <p className="text-[10px] uppercase tracking-[0.25em]" style={{ color: 'rgba(245, 197, 24, 0.7)' }}>
            Trip2Talk
          </p>
          <h2 id="t2t-consent-title" className="mt-1 text-lg font-semibold" style={{ color: '#F5C518' }}>
            ข้อตกลงและความยินยอมผู้เข้าร่วมทริป
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-neutral-400">
            กรุณาอ่านให้ครบและกรอกชื่อก่อนกดยินยอม (แสดงครั้งเดียวต่ออุปกรณ์)
          </p>
        </header>

        <div className="shrink-0 px-5 pt-4">
          <label htmlFor="t2t-consent-name" className="block text-xs font-medium text-neutral-300 mb-1.5">
            ชื่อ-นามสกุล <span style={{ color: '#F5C518' }}>*</span>
          </label>
          <input
            id="t2t-consent-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น สมชาย ใจดี"
            autoComplete="name"
            className="w-full rounded-xl border bg-neutral-900 px-3 py-2.5 text-sm text-neutral-100 placeholder:text-neutral-600 outline-none focus:ring-2"
            style={
              {
                borderColor: 'rgba(245, 197, 24, 0.25)',
                '--tw-ring-color': 'rgba(245, 197, 24, 0.4)',
              } as CSSProperties
            }
          />
        </div>

        <div className="relative min-h-0 flex-1 px-5 py-3">
          <div
            ref={scrollRef}
            onScroll={checkScrollEnd}
            className="h-[min(42vh,320px)] overflow-y-auto rounded-xl border px-4 py-3 text-sm leading-relaxed text-neutral-300"
            style={{
              borderColor: 'rgba(255,255,255,0.08)',
              background: '#0a0a0a',
              scrollbarWidth: 'thin',
              scrollbarColor: '#F5C518 #1a1a1a',
            }}
          >
            <p className="mb-4 text-neutral-400">
              โดยการกด &quot;ยินยอม&quot; ข้าพเจ้าได้อ่านและเข้าใจข้อความด้านล่างนี้แล้ว
            </p>
            {CONSENT_SECTIONS.map((section) => (
              <section key={section.title} className="mb-4 last:mb-0">
                <h3 className="mb-1 text-sm font-semibold" style={{ color: '#F5C518' }}>
                  {section.title}
                </h3>
                <p>{section.body}</p>
              </section>
            ))}
            <p className="mt-4 text-xs text-neutral-500 border-t border-neutral-800 pt-3">
              หากมีคำถาม ติดต่อ Trip2Talk ผ่านช่องทางที่แจ้งในเอกสารการจองของท่าน
            </p>
          </div>

          {!scrolledToEnd && (
            <p
              className="pointer-events-none absolute bottom-5 left-0 right-0 text-center text-[11px] font-medium animate-pulse"
              style={{ color: 'rgba(245, 197, 24, 0.85)' }}
            >
              ↓ เลื่อนลงเพื่ออ่านให้ครบ
            </p>
          )}
        </div>

        <footer
          className="shrink-0 flex flex-col gap-2 border-t px-5 py-4 sm:flex-row"
          style={{ borderColor: 'rgba(245, 197, 24, 0.2)' }}
        >
          <button
            type="button"
            onClick={handleDecline}
            disabled={submitting}
            className="flex-1 rounded-xl border px-4 py-3 text-sm font-medium text-neutral-400 transition active:scale-[0.98] disabled:opacity-50"
            style={{ borderColor: 'rgba(255,255,255,0.12)' }}
          >
            ไม่ยินยอม
          </button>
          <button
            type="button"
            onClick={() => void handleAccept()}
            disabled={!canConsent}
            className="flex-1 rounded-xl px-4 py-3 text-sm font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
            style={{
              background: canConsent ? '#F5C518' : 'rgba(245, 197, 24, 0.2)',
              color: canConsent ? '#0a0a0a' : 'rgba(255,255,255,0.35)',
            }}
            title={
              !nameOk
                ? 'กรุณากรอกชื่อ-นามสกุล'
                : !scrolledToEnd
                  ? 'กรุณาเลื่อนอ่านให้ครบ'
                  : undefined
            }
          >
            {submitting ? 'กำลังบันทึก…' : 'ยินยอม'}
          </button>
        </footer>
      </div>
    </div>
  )
}
