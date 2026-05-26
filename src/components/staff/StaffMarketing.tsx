import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchTripGalleryPhotos } from '../../lib/tripGalleryPhotos'
import {
  charLimitForPlatform,
  FB_CHAR_LIMIT,
  generateCaptionSuggestions,
  hashtagSuggestions,
  IG_CHAR_LIMIT,
  MARKETING_STORAGE_KEY,
  newDraftPost,
  readMarketingStore,
  writeMarketingStore,
  type CaptionTone,
  type MarketingPhotoRef,
  type MarketingPlatform,
  type MarketingPost,
  type MarketingPostStatus,
  type MarketingStore,
} from '../../lib/staffMarketing'
import type { Tour } from '../../types/tour'
import type { TripGalleryPhoto } from '../../types/missing_tables'
import '../../styles/staff-marketing.css'

const GOLD = '#F59E0B'
const BG = '#111113'

const PLATFORMS: { id: MarketingPlatform; label: string }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'both', label: 'Both' },
]

const TONES: { id: CaptionTone; label: string }[] = [
  { id: 'professional', label: 'Professional' },
  { id: 'casual', label: 'Casual' },
  { id: 'fun', label: 'Fun' },
]

const STATUS_LABELS: Record<MarketingPostStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  posted: 'Posted',
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function MarketingCard({
  title,
  children,
  className = '',
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`staff-mkt__card ${className}`}>
      <h3 className="staff-mkt__card-title">{title}</h3>
      {children}
    </section>
  )
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function dateKey(year: number, month: number, day: number): string {
  return `${monthKey(year, month)}-${String(day).padStart(2, '0')}`
}

export default function StaffMarketing({ activeTour }: { activeTour: Tour | null }) {
  const [store, setStore] = useState<MarketingStore>(() => readMarketingStore())
  const [gallery, setGallery] = useState<TripGalleryPhoto[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [galleryError, setGalleryError] = useState<string | null>(null)
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const n = new Date()
    return { year: n.getFullYear(), month: n.getMonth() }
  })
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const [saveHint, setSaveHint] = useState<string | null>(null)

  const draft = useMemo(() => {
    const id = store.activeDraftId
    const found = id ? store.posts.find((p) => p.id === id) : null
    if (found) return found
    const existingDraft = store.posts.find((p) => p.status === 'draft')
    if (existingDraft) return existingDraft
    return null
  }, [store])

  const updateDraft = useCallback(
    (patch: Partial<MarketingPost>) => {
      const current = draft ?? newDraftPost()
      const id = draft?.id ?? current.id
      const updated: MarketingPost = {
        ...current,
        ...patch,
        id,
        updatedAt: new Date().toISOString(),
      }
      const others = store.posts.filter((p) => p.id !== id)
      const next: MarketingStore = {
        posts: [updated, ...others],
        activeDraftId: id,
      }
      setStore(next)
      writeMarketingStore(next)
      setSaveHint('Draft saved')
      window.setTimeout(() => setSaveHint(null), 1500)
    },
    [draft, store.posts]
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setGalleryLoading(true)
      setGalleryError(null)
      try {
        const photos = await fetchTripGalleryPhotos({ dest: activeTour?.destination ?? 'New Zealand' })
        if (!cancelled) setGallery(photos)
      } catch (e) {
        if (!cancelled) setGalleryError(e instanceof Error ? e.message : 'Gallery load failed')
      } finally {
        if (!cancelled) setGalleryLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTour?.destination])

  useEffect(() => {
    if (draft) return
    setStore((prev) => {
      if (prev.activeDraftId && prev.posts.some((p) => p.id === prev.activeDraftId)) {
        return prev
      }
      if (prev.posts.length > 0) {
        const next = { ...prev, activeDraftId: prev.posts[0].id }
        writeMarketingStore(next)
        return next
      }
      const post = newDraftPost()
      const next = { posts: [post], activeDraftId: post.id }
      writeMarketingStore(next)
      return next
    })
  }, [draft])

  const active = draft ?? newDraftPost()
  const charLimit = charLimitForPlatform(active.platform)
  const charCount = active.caption.length
  const overLimit = charCount > charLimit

  const postsByDate = useMemo(() => {
    const map = new Map<string, MarketingPost[]>()
    for (const p of store.posts) {
      if (!p.scheduledDate) continue
      const list = map.get(p.scheduledDate) ?? []
      list.push(p)
      map.set(p.scheduledDate, list)
    }
    return map
  }, [store.posts])

  const calendarCells = useMemo(() => {
    const { year, month } = calendarMonth
    const first = new Date(year, month, 1)
    const startPad = (first.getDay() + 6) % 7
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: { day: number | null; key: string }[] = []
    for (let i = 0; i < startPad; i++) cells.push({ day: null, key: `pad-${i}` })
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, key: dateKey(year, month, d) })
    }
    return cells
  }, [calendarMonth])

  const togglePhoto = (photo: TripGalleryPhoto) => {
    const ref: MarketingPhotoRef = {
      id: photo.id,
      public_url: photo.public_url,
      caption_en: photo.caption_en,
    }
    const has = active.photoRefs.some((p) => p.id === photo.id)
    let next: MarketingPhotoRef[]
    if (has) {
      next = active.photoRefs.filter((p) => p.id !== photo.id)
    } else {
      if (active.photoRefs.length >= 10) return
      next = [...active.photoRefs, ref]
    }
    updateDraft({ photoRefs: next })
  }

  const scheduleOnDate = (key: string) => {
    updateDraft({
      scheduledDate: key,
      status: active.caption.trim() ? 'scheduled' : 'draft',
    })
  }

  const applySuggestion = (text: string) => {
    updateDraft({ caption: text })
  }

  const runCaptionAi = () => {
    const refs = active.photoRefs
    if (refs.length === 0) {
      setSuggestions(['Select at least one gallery photo for tailored captions.'])
      return
    }
    setSuggestions(generateCaptionSuggestions(refs, active.tone, activeTour?.destination))
  }

  const copyCaption = async () => {
    const tags = hashtagSuggestions(activeTour?.destination).join(' ')
    const body = active.caption.trim()
      ? `${active.caption.trim()}\n\n${tags}`
      : tags
    try {
      await navigator.clipboard.writeText(body)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  const setStatus = (status: MarketingPostStatus) => {
    updateDraft({ status })
  }

  const startNewDraft = () => {
    const post = newDraftPost()
    const next: MarketingStore = {
      posts: [post, ...store.posts],
      activeDraftId: post.id,
    }
    setStore(next)
    writeMarketingStore(next)
    setSuggestions([])
  }

  const monthLabel = new Date(calendarMonth.year, calendarMonth.month, 1).toLocaleDateString(
    'en-AU',
    { month: 'long', year: 'numeric' }
  )

  const previewPlatform =
    active.platform === 'both' ? 'Instagram / Facebook' : active.platform === 'instagram' ? 'Instagram' : 'Facebook'

  return (
    <div className="staff-mkt" style={{ background: BG }}>
      <div className="staff-mkt__header">
        <div>
          <p className="staff-mkt__eyebrow">Trip2Talk · Marketing</p>
          <h2 className="staff-mkt__heading">Content studio</h2>
          {activeTour && (
            <p className="staff-mkt__sub">
              Gallery: {activeTour.destination} · {activeTour.trip_code}
            </p>
          )}
        </div>
        <div className="staff-mkt__header-actions">
          {saveHint && <span className="staff-mkt__saved">{saveHint}</span>}
          <button type="button" className="staff-mkt__btn-ghost" onClick={startNewDraft}>
            New draft
          </button>
        </div>
      </div>

      <div className="staff-mkt__grid">
        <div className="staff-mkt__col">
          <MarketingCard title="1 · Post composer">
            <label className="staff-mkt__label" htmlFor="mkt-caption">
              Caption
            </label>
            <textarea
              id="mkt-caption"
              className="staff-mkt__textarea"
              rows={5}
              value={active.caption}
              onChange={(e) => updateDraft({ caption: e.target.value })}
              placeholder="Write your post caption…"
            />

            <p className="staff-mkt__label mt-3">Platform</p>
            <div className="staff-mkt__pills">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`staff-mkt__pill ${active.platform === p.id ? 'staff-mkt__pill--on' : ''}`}
                  onClick={() => updateDraft({ platform: p.id })}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="staff-mkt__counters">
              <span className={overLimit ? 'staff-mkt__over' : ''}>
                {charCount.toLocaleString()} / {charLimit.toLocaleString()}
                {active.platform === 'both' && ' (IG limit)'}
              </span>
              {active.platform === 'both' && (
                <span className="staff-mkt__counter-muted">
                  FB max {FB_CHAR_LIMIT.toLocaleString()} · IG max {IG_CHAR_LIMIT.toLocaleString()}
                </span>
              )}
            </div>

            <div className="staff-mkt__preview">
              <p className="staff-mkt__preview-label">{previewPlatform} preview</p>
              <div className="staff-mkt__preview-card">
                {active.photoRefs[0] ? (
                  <img src={active.photoRefs[0].public_url} alt="" className="staff-mkt__preview-img" />
                ) : (
                  <div className="staff-mkt__preview-placeholder">No image selected</div>
                )}
                <div className="staff-mkt__preview-body">
                  <p className="staff-mkt__preview-account">Trip2Talk</p>
                  <p className="staff-mkt__preview-caption">
                    {active.caption.trim() || 'Your caption will appear here…'}
                  </p>
                  {active.photoRefs.length > 1 && (
                    <p className="staff-mkt__preview-meta">+{active.photoRefs.length - 1} more photos</p>
                  )}
                </div>
              </div>
            </div>

            <div className="staff-mkt__status-row">
              <span className="staff-mkt__label">Status</span>
              {(['draft', 'scheduled', 'posted'] as MarketingPostStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`staff-mkt__status ${active.status === s ? 'staff-mkt__status--on' : ''}`}
                  onClick={() => setStatus(s)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </MarketingCard>

          <MarketingCard title="4 · Caption writer">
            <p className="staff-mkt__label">Tone</p>
            <div className="staff-mkt__pills">
              {TONES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`staff-mkt__pill ${active.tone === t.id ? 'staff-mkt__pill--on' : ''}`}
                  onClick={() => updateDraft({ tone: t.id })}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button type="button" className="staff-mkt__btn-gold mt-3" onClick={runCaptionAi}>
              Generate caption suggestions
            </button>

            {suggestions.length > 0 && (
              <ul className="staff-mkt__suggestions">
                {suggestions.map((s, i) => (
                  <li key={i}>
                    <pre className="staff-mkt__suggestion-text">{s}</pre>
                    <button type="button" className="staff-mkt__btn-ghost" onClick={() => applySuggestion(s)}>
                      Use this
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <p className="staff-mkt__label mt-4">Hashtags (AU / NZ)</p>
            <p className="staff-mkt__tags">{hashtagSuggestions(activeTour?.destination).join(' ')}</p>

            <button type="button" className="staff-mkt__btn-gold mt-3" onClick={() => void copyCaption()}>
              {copied ? 'Copied!' : 'Copy caption + hashtags'}
            </button>
          </MarketingCard>
        </div>

        <div className="staff-mkt__col">
          <MarketingCard title="2 · Schedule calendar">
            <div className="staff-mkt__cal-nav">
              <button
                type="button"
                className="staff-mkt__btn-ghost"
                onClick={() =>
                  setCalendarMonth((m) => {
                    const d = new Date(m.year, m.month - 1, 1)
                    return { year: d.getFullYear(), month: d.getMonth() }
                  })
                }
              >
                ‹
              </button>
              <span className="staff-mkt__cal-month">{monthLabel}</span>
              <button
                type="button"
                className="staff-mkt__btn-ghost"
                onClick={() =>
                  setCalendarMonth((m) => {
                    const d = new Date(m.year, m.month + 1, 1)
                    return { year: d.getFullYear(), month: d.getMonth() }
                  })
                }
              >
                ›
              </button>
            </div>

            <div className="staff-mkt__cal-weekdays">
              {WEEKDAYS.map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>

            <div className="staff-mkt__cal-grid">
              {calendarCells.map((cell) => {
                if (cell.day === null) {
                  return <span key={cell.key} className="staff-mkt__cal-empty" />
                }
                const key = cell.key
                const scheduled = postsByDate.get(key) ?? []
                const isSelected = active.scheduledDate === key
                return (
                  <button
                    key={key}
                    type="button"
                    className={`staff-mkt__cal-day ${isSelected ? 'staff-mkt__cal-day--selected' : ''}`}
                    onClick={() => scheduleOnDate(key)}
                    title={scheduled.map((p) => p.caption.slice(0, 40) || 'Post').join('\n')}
                  >
                    <span>{cell.day}</span>
                    {scheduled.length > 0 && (
                      <span className="staff-mkt__cal-dots" aria-hidden>
                        {scheduled.slice(0, 3).map((p) => (
                          <i
                            key={p.id}
                            className={`staff-mkt__dot staff-mkt__dot--${p.status}`}
                          />
                        ))}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            <p className="staff-mkt__hint">
              Click a date to schedule the current draft
              {active.scheduledDate ? ` · ${active.scheduledDate}` : ''}
            </p>

            {store.posts.filter((p) => p.scheduledDate).length > 0 && (
              <ul className="staff-mkt__scheduled-list">
                {store.posts
                  .filter((p) => p.scheduledDate)
                  .sort((a, b) => (a.scheduledDate! < b.scheduledDate! ? -1 : 1))
                  .slice(0, 6)
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="staff-mkt__scheduled-item"
                        onClick={() =>
                          setStore((prev) => {
                            const next = { ...prev, activeDraftId: p.id }
                            writeMarketingStore(next)
                            return next
                          })
                        }
                      >
                        <span className={`staff-mkt__badge staff-mkt__badge--${p.status}`}>
                          {STATUS_LABELS[p.status]}
                        </span>
                        <span className="staff-mkt__scheduled-date">{p.scheduledDate}</span>
                        <span className="staff-mkt__scheduled-cap">
                          {p.caption.slice(0, 48) || '(no caption)'}
                        </span>
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </MarketingCard>

          <MarketingCard title="3 · Photo picker">
            {galleryLoading && <p className="staff-mkt__hint">Loading gallery…</p>}
            {galleryError && <p className="staff-mkt__error">{galleryError}</p>}
            {!galleryLoading && gallery.length === 0 && (
              <p className="staff-mkt__hint">No gallery photos for this destination.</p>
            )}
            <div className="staff-mkt__photo-grid">
              {gallery.map((photo) => {
                const selected = active.photoRefs.some((p) => p.id === photo.id)
                return (
                  <button
                    key={photo.id}
                    type="button"
                    className={`staff-mkt__photo ${selected ? 'staff-mkt__photo--on' : ''}`}
                    onClick={() => togglePhoto(photo)}
                  >
                    <img src={photo.public_url} alt={photo.caption_en} loading="lazy" />
                    {selected && <span className="staff-mkt__photo-check">✓</span>}
                  </button>
                )
              })}
            </div>
            <p className="staff-mkt__hint">
              Select 1–10 images ({active.photoRefs.length}/10)
            </p>
          </MarketingCard>
        </div>
      </div>

      {active.photoRefs.length > 0 && (
        <div className="staff-mkt__strip" style={{ borderColor: `${GOLD}44` }}>
          <p className="staff-mkt__strip-label">Selected</p>
          <div className="staff-mkt__strip-scroll">
            {active.photoRefs.map((p) => (
              <button
                key={p.id}
                type="button"
                className="staff-mkt__strip-thumb"
                onClick={() =>
                  updateDraft({
                    photoRefs: active.photoRefs.filter((x) => x.id !== p.id),
                  })
                }
                title="Remove"
              >
                <img src={p.public_url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="staff-mkt__storage-note">
        Drafts saved to localStorage ({MARKETING_STORAGE_KEY})
      </p>
    </div>
  )
}
