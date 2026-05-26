import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

type Lang = 'TH' | 'EN'

type UpcomingTripRow = {
  id: string
  image_url: string | null
  trip_type: string | null
  location: string | null
  template_a: string | null
  template_b: string | null
  template_a_en: string | null
  template_b_en: string | null
  next_trip_date: string | null
  seats_remaining: number | null
}

function templateAForRow(row: UpcomingTripRow, lang: Lang): string {
  if (lang === 'EN' && row.template_a_en?.trim()) return row.template_a_en
  return row.template_a ?? ''
}

function templateBForRow(row: UpcomingTripRow, lang: Lang): string {
  if (lang === 'EN' && row.template_b_en?.trim()) return row.template_b_en
  return row.template_b ?? ''
}

function formatDateLabel(dateStr: string, lang: Lang): string {
  // Stored as DATE in Supabase; treat as UTC date.
  const d = new Date(`${dateStr}T00:00:00Z`)
  return new Intl.DateTimeFormat(lang === 'TH' ? 'en-GB' : 'en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d)
}

function clampLines(text: string, maxLines: number): string {
  // UI uses CSS line-clamp; this is just defensive trimming.
  return text.trim().split('\n').filter(Boolean).join('\n').trim() || ''
}

function tripLabel(tripType: string | null): string {
  if (!tripType) return '—'
  return tripType
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function UpcomingTrips() {
  const [lang, setLang] = useState<Lang>('TH')
  const [rows, setRows] = useState<UpcomingTripRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [active, setActive] = useState<UpcomingTripRow | null>(null)
  const [copied, setCopied] = useState(false)
  const [mounted, setMounted] = useState(false)

  const todayIso = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data, error: err } = await supabase
          .from('gallery_posts')
          .select(
            'id,image_url,trip_type,location,template_a,template_b,template_a_en,template_b_en,next_trip_date,seats_remaining',
          )
          .gte('next_trip_date', todayIso)
          .order('next_trip_date', { ascending: true })
          .limit(10)
        if (err) throw err
        if (!cancelled) setRows((data ?? []) as UpcomingTripRow[])
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load upcoming trips')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [todayIso])

  const title = lang === 'TH' ? '🗓 ทริปที่เปิดรับสมัคร' : 'Upcoming Trips'
  const detailsLabel = lang === 'TH' ? 'ดูรายละเอียด' : 'View details'
  const copyLabel = lang === 'TH' ? 'คัดลอก Template B' : 'Copy Template B'
  const closeLabel = lang === 'TH' ? 'ปิด' : 'Close'

  const onCopy = async () => {
    if (!active) return
    const text = templateBForRow(active, lang)
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1400)
    } catch {
      window.prompt('Copy:', text)
    }
  }

  return (
    <section className={`t2t-upcoming ${mounted ? 't2t-upcoming--in' : ''}`}>
      <div className="t2t-upcoming__header">
        <h2 className="t2t-upcoming__title">{title}</h2>
        <div className="t2t-upcoming__lang">
          {(['TH', 'EN'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLang(l)}
              className={`t2t-upcoming__langbtn ${lang === l ? 'is-active' : ''}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="t2t-upcoming__skeletonrow" aria-hidden>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="t2t-upcoming__skeleton" />
          ))}
        </div>
      ) : error ? (
        <div className="t2t-upcoming__err">
          <p className="t2t-upcoming__errtxt">{error}</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="t2t-upcoming__empty">
          <p className="t2t-upcoming__muted">{lang === 'TH' ? 'ยังไม่มีทริปที่กำลังเปิดรับสมัคร' : 'No upcoming trips yet'}</p>
        </div>
      ) : (
        <div className="t2t-upcoming__scroller" role="list">
          {rows.map((r) => (
            <article key={r.id} className="t2t-upcoming__card" role="listitem">
              <div className="t2t-upcoming__imgwrap">
                {r.image_url ? (
                  <img src={r.image_url} alt={r.location ?? 'Trip'} className="t2t-upcoming__img" loading="lazy" />
                ) : (
                  <div className="t2t-upcoming__img t2t-upcoming__img--placeholder" />
                )}
                {typeof r.seats_remaining === 'number' && (
                  <div className="t2t-upcoming__seats">
                    {lang === 'TH' ? `เหลือ ${r.seats_remaining} ที่นั่ง` : `${r.seats_remaining} seats left`}
                  </div>
                )}
              </div>
              <div className="t2t-upcoming__body">
                <div className="t2t-upcoming__meta">
                  <p className="t2t-upcoming__trip">{tripLabel(r.trip_type)}</p>
                  <p className="t2t-upcoming__loc">{r.location ?? '—'}</p>
                </div>
                <p className="t2t-upcoming__cap line-clamp-3">
                  {clampLines(templateAForRow(r, lang), 3) || '—'}
                </p>
                <div className="t2t-upcoming__footer">
                  <p className="t2t-upcoming__date">
                    {r.next_trip_date ? formatDateLabel(r.next_trip_date, lang) : '—'}
                  </p>
                  <button type="button" className="t2t-upcoming__cta" onClick={() => setActive(r)}>
                    {detailsLabel}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {active && (
        <div className="t2t-upcoming__modal" role="dialog" aria-modal="true">
          <div className="t2t-upcoming__modalbg" onClick={() => setActive(null)} aria-hidden />
          <div className="t2t-upcoming__modalpanel">
            <div className="t2t-upcoming__modalbar">
              <button type="button" className="t2t-upcoming__close" onClick={() => setActive(null)}>
                {closeLabel}
              </button>
              <button type="button" className="t2t-upcoming__copy" onClick={() => void onCopy()}>
                {copied ? (lang === 'TH' ? 'คัดลอกแล้ว' : 'Copied') : copyLabel}
              </button>
            </div>
            {active.image_url && (
              <img src={active.image_url} alt={active.location ?? 'Trip'} className="t2t-upcoming__modalimg" />
            )}
            <pre className="t2t-upcoming__modaltext">{templateBForRow(active, lang)}</pre>
          </div>
        </div>
      )}

      <style>{`
        .t2t-upcoming {
          padding: 14px 12px 10px;
          background: #0a0a0a;
          border-bottom: 1px solid rgba(201, 168, 76, 0.18);
          opacity: 0;
          transform: translateY(6px);
          transition: opacity 350ms ease, transform 350ms ease;
        }
        .t2t-upcoming--in { opacity: 1; transform: translateY(0); }
        .t2t-upcoming__header { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom: 12px; }
        .t2t-upcoming__title { margin:0; font-size: 14px; font-weight: 800; letter-spacing: 0.02em; color: #e8f4ff; }
        .t2t-upcoming__lang { display:flex; border:1px solid rgba(0,212,212,0.25); border-radius: 999px; padding: 2px; }
        .t2t-upcoming__langbtn {
          border: none;
          background: transparent;
          color: rgba(232,244,255,0.6);
          font-weight: 800;
          font-size: 11px;
          padding: 6px 10px;
          border-radius: 999px;
          cursor: pointer;
        }
        .t2t-upcoming__langbtn.is-active {
          background: rgba(0,212,212,0.18);
          color: #C9A84C;
          box-shadow: 0 0 18px rgba(0,212,212,0.18);
        }

        .t2t-upcoming__scroller {
          display: grid;
          grid-auto-flow: column;
          grid-auto-columns: minmax(260px, 1fr);
          gap: 12px;
          overflow-x: auto;
          padding-bottom: 8px;
          scroll-snap-type: x mandatory;
        }
        .t2t-upcoming__card {
          scroll-snap-align: start;
          background: #1a1a1a;
          border: 1px solid rgba(201, 168, 76, 0.18);
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 0 24px rgba(201, 168, 76, 0.06);
          display:flex;
          flex-direction: column;
          min-height: 320px;
        }
        .t2t-upcoming__imgwrap { position: relative; }
        .t2t-upcoming__img { width: 100%; height: 160px; object-fit: cover; display:block; }
        .t2t-upcoming__img--placeholder { background: linear-gradient(135deg, rgba(0,212,212,0.12), rgba(255,255,255,0.03)); }
        .t2t-upcoming__seats {
          position:absolute;
          bottom: 10px;
          left: 10px;
          background: #C9A84C;
          color: #0a0a0a;
          font-size: 11px;
          font-weight: 900;
          padding: 6px 10px;
          border-radius: 999px;
        }
        .t2t-upcoming__body { padding: 12px; display:flex; flex-direction: column; gap: 10px; flex:1; }
        .t2t-upcoming__trip { margin:0; color:#C9A84C; font-weight: 900; font-size: 12px; }
        .t2t-upcoming__loc { margin: 2px 0 0; color: rgba(232,244,255,0.65); font-size: 12px; }
        .t2t-upcoming__cap { margin:0; color: rgba(232,244,255,0.82); font-size: 12px; line-height: 1.35; }
        .t2t-upcoming__footer { margin-top: auto; display:flex; align-items:center; justify-content:space-between; gap: 10px; }
        .t2t-upcoming__date { margin:0; color: rgba(232,244,255,0.55); font-size: 11px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .t2t-upcoming__cta {
          border: 1px solid rgba(201, 168, 76, 0.45);
          background: rgba(201, 168, 76, 0.12);
          color: #C9A84C;
          font-weight: 900;
          font-size: 12px;
          padding: 8px 10px;
          border-radius: 12px;
          cursor: pointer;
        }
        .t2t-upcoming__cta:active { transform: scale(0.98); }

        .t2t-upcoming__skeletonrow { display:grid; grid-auto-flow: column; grid-auto-columns: minmax(260px, 1fr); gap:12px; overflow:hidden; padding-bottom: 6px; }
        .t2t-upcoming__skeleton {
          height: 320px;
          border-radius: 16px;
          background: linear-gradient(90deg, rgba(255,255,255,0.04), rgba(0,212,212,0.06), rgba(255,255,255,0.04));
          background-size: 200% 100%;
          animation: t2tShimmer 1.2s linear infinite;
          border: 1px solid rgba(0,212,212,0.12);
        }
        @keyframes t2tShimmer { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
        .t2t-upcoming__err, .t2t-upcoming__empty {
          background: rgba(26,26,26,0.9);
          border: 1px solid rgba(0,212,212,0.14);
          border-radius: 12px;
          padding: 12px;
        }
        .t2t-upcoming__errtxt { margin:0; color: #ff6b6b; font-size: 12px; }
        .t2t-upcoming__muted { margin:0; color: rgba(232,244,255,0.6); font-size: 12px; }

        .t2t-upcoming__modal { position: fixed; inset: 0; z-index: 120; display:flex; align-items: stretch; justify-content: center; }
        .t2t-upcoming__modalbg { position:absolute; inset:0; background: rgba(0,0,0,0.72); }
        .t2t-upcoming__modalpanel {
          position: relative;
          z-index: 121;
          width: min(720px, 100%);
          margin: 0 auto;
          background: #0a0a0a;
          border-left: 1px solid rgba(0,212,212,0.25);
          border-right: 1px solid rgba(0,212,212,0.25);
          display:flex;
          flex-direction: column;
          max-height: 100vh;
        }
        .t2t-upcoming__modalbar {
          position: sticky;
          top: 0;
          z-index: 2;
          display:flex;
          justify-content: space-between;
          gap: 10px;
          padding: 12px;
          background: rgba(10,10,10,0.96);
          border-bottom: 1px solid rgba(0,212,212,0.18);
          backdrop-filter: blur(12px);
        }
        .t2t-upcoming__close, .t2t-upcoming__copy {
          border-radius: 12px;
          padding: 10px 12px;
          font-weight: 900;
          font-size: 12px;
          cursor: pointer;
        }
        .t2t-upcoming__close {
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(255,255,255,0.05);
          color: rgba(232,244,255,0.75);
        }
        .t2t-upcoming__copy {
          border: 1px solid rgba(201, 168, 76, 0.45);
          background: rgba(201, 168, 76, 0.12);
          color: #C9A84C;
        }
        .t2t-upcoming__modalimg { width: 100%; max-height: 44vh; object-fit: cover; }
        .t2t-upcoming__modaltext {
          margin: 0;
          padding: 14px 14px 30px;
          white-space: pre-wrap;
          color: rgba(232,244,255,0.88);
          font-size: 12px;
          line-height: 1.45;
          overflow: auto;
          flex: 1;
        }

        @media (min-width: 900px) {
          .t2t-upcoming__scroller {
            grid-auto-flow: row;
            grid-auto-columns: unset;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            overflow-x: visible;
          }
          .t2t-upcoming__card { min-height: 340px; }
        }
      `}</style>
    </section>
  )
}

