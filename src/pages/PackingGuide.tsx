import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchPackingItems } from '../lib/missingTablesQueries'
import { NZ_WINTER_PACKING_FALLBACK } from '../lib/nzWinterPackingFallback'
import { getStoredClientId, useClientSession } from '../hooks/useClientSession'
import type { TourDestination } from '../types/tour'
import { T2Button, T2Card, SkeletonCard } from '../components/trip2talk/Trip2TalkShell'
import { TRIP2TALK_PIXIESET_URL } from '../lib/trip2talkLinks'
import type { PackingCategory, PackingItemRow, Season } from '../types/missing_tables'

const CATEGORY_ORDER: PackingCategory[] = [
  'documents',
  'clothing',
  'toiletries',
  'electronics',
  'health',
  'other',
]

const CATEGORY_LABELS: Record<PackingCategory, { en: string; th: string }> = {
  documents: { en: 'Documents', th: 'เอกสาร' },
  clothing: { en: 'Clothing', th: 'เสื้อผ้า' },
  toiletries: { en: 'Toiletries', th: 'ของใช้ส่วนตัว' },
  electronics: { en: 'Electronics', th: 'อุปกรณ์อิเล็กทรอนิกส์' },
  health: { en: 'Health', th: 'สุขภาพ' },
  other: { en: 'Other', th: 'อื่นๆ' },
}

/** PACK tab always shows the NZ winter checklist (Trip2Talk default). */
const PACK_DEST: TourDestination = 'New Zealand'
const PACK_SEASON: Season = 'winter'

const SEASON_LABELS: Record<Season, { en: string; th: string }> = {
  summer: { en: 'Summer', th: 'ฤดูร้อน' },
  autumn: { en: 'Autumn', th: 'ฤดูใบไม้ร่วง' },
  winter: { en: 'Winter', th: 'ฤดูหนาว' },
  spring: { en: 'Spring', th: 'ฤดูใบไม้ผลิ' },
}

interface PackingStorage {
  checkedIds: string[]
}

function packingStorageKey(
  clientId: string,
  tripCode: string,
  dest: string,
  season: Season
): string {
  return `packing_${clientId}_${tripCode}_${dest}_${season}`
}

function readChecked(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as PackingStorage
    return new Set(Array.isArray(parsed.checkedIds) ? parsed.checkedIds : [])
  } catch {
    return new Set()
  }
}

function writeChecked(key: string, ids: Set<string>): void {
  const payload: PackingStorage = { checkedIds: [...ids] }
  localStorage.setItem(key, JSON.stringify(payload))
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const offset = c - (pct / 100) * c
  return (
    <svg width="44" height="44" className="-rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-neutral-800" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="text-amber-400 transition-all duration-300"
      />
    </svg>
  )
}

export default function PackingGuide() {
  const { clientId, displayTour } = useClientSession()
  const [items, setItems] = useState<PackingItemRow[]>(() => NZ_WINTER_PACKING_FALLBACK)
  const [itemsLoading, setItemsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeCategory, setActiveCategory] = useState<PackingCategory>('documents')
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set())
  const [showCelebration, setShowCelebration] = useState(false)
  const [celebrated, setCelebrated] = useState(false)

  const storedClientId = clientId ?? getStoredClientId() ?? 'guest'
  const tripCode = displayTour?.trip_code ?? 'NZ-WINTER'
  const dest = PACK_DEST
  const season = PACK_SEASON

  const storageKey = useMemo(() => {
    return packingStorageKey(storedClientId, tripCode, dest, season)
  }, [storedClientId, tripCode, dest, season])

  const loadItems = useCallback(async () => {
    setItemsLoading(true)
    setError(null)
    try {
      const rows = await fetchPackingItems({ dest: PACK_DEST, season: PACK_SEASON })
      setItems(rows.length > 0 ? rows : NZ_WINTER_PACKING_FALLBACK)
    } catch (e) {
      setItems(NZ_WINTER_PACKING_FALLBACK)
      setError(null)
    } finally {
      setItemsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  useEffect(() => {
    const cats = CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c))
    if (cats.length && !cats.includes(activeCategory)) {
      setActiveCategory(cats[0])
    }
  }, [items, activeCategory])

  useEffect(() => {
    if (!storageKey) {
      setCheckedIds(new Set())
      return
    }
    setCheckedIds(readChecked(storageKey))
  }, [storageKey])

  const categoriesWithItems = useMemo(() => {
    return CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c))
  }, [items])

  const categoryItems = useMemo(
    () => items.filter((i) => i.category === activeCategory),
    [items, activeCategory]
  )

  const mustHave = categoryItems.filter((i) => i.priority === 'must_have')
  const niceToHave = categoryItems.filter((i) => i.priority === 'nice_to_have')

  const totalCount = items.length
  const checkedCount = items.filter((i) => checkedIds.has(i.id)).length
  const overallPct = totalCount ? Math.round((checkedCount / totalCount) * 100) : 0

  const categoryChecked = categoryItems.filter((i) => checkedIds.has(i.id)).length
  const categoryPct = categoryItems.length
    ? Math.round((categoryChecked / categoryItems.length) * 100)
    : 0

  const weatherNote = useMemo(() => {
    const withNote = items.find((i) => i.weather_note_en || i.weather_note_th)
    return withNote
      ? { en: withNote.weather_note_en, th: withNote.weather_note_th }
      : null
  }, [items])

  const toggleItem = (id: string) => {
    if (!storageKey) return
    setCheckedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeChecked(storageKey, next)
      return next
    })
  }

  useEffect(() => {
    if (overallPct === 100 && totalCount > 0 && !celebrated) {
      setShowCelebration(true)
      setCelebrated(true)
    }
    if (overallPct < 100) {
      setCelebrated(false)
    }
  }, [overallPct, totalCount, celebrated])

  if (itemsLoading && items.length === 0) {
    return (
      <div className="space-y-4 px-4 pb-6 pt-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-neutral-800" />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      {showCelebration && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-labelledby="packing-complete-title"
        >
          <T2Card className="max-w-sm border-amber-500/50 text-center">
            <p className="text-4xl" aria-hidden>
              🎉
            </p>
            <h2 id="packing-complete-title" className="mt-2 text-lg font-bold text-amber-400">
              100% packed!
            </h2>
            <p className="mt-1 text-sm text-neutral-400">
              คุณพร้อมแล้ว — You&apos;re ready for {dest}.
            </p>
            <div className="mt-4">
              <T2Button onClick={() => setShowCelebration(false)}>Continue</T2Button>
            </div>
          </T2Card>
        </div>
      )}

      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-amber-400/90">
          {tripCode}
        </p>
        <h1 className="text-xl font-bold text-neutral-50">Packing guide</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {dest} · {SEASON_LABELS[season].en} ({SEASON_LABELS[season].th})
        </p>
      </header>

      <T2Card className="flex items-center gap-4">
        <div className="relative flex items-center justify-center text-amber-400">
          <ProgressRing pct={overallPct} />
          <span className="absolute text-xs font-bold text-neutral-100">{overallPct}%</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-neutral-100">Overall progress</p>
          <p className="text-xs text-neutral-500">
            {checkedCount} of {totalCount} items packed
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-300"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </T2Card>

      {weatherNote && (weatherNote.en || weatherNote.th) && (
        <T2Card className="border-sky-500/20 bg-sky-950/20">
          <p className="text-xs font-semibold uppercase tracking-wide text-sky-400">
            Weather note
          </p>
          {weatherNote.en && (
            <p className="mt-1 text-sm text-neutral-200">{weatherNote.en}</p>
          )}
          {weatherNote.th && (
            <p className="mt-1 text-xs text-neutral-500">{weatherNote.th}</p>
          )}
        </T2Card>
      )}

      {error && (
        <p className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {items.length === 0 && !error ? (
        <T2Card>
          <p className="text-sm text-neutral-400">
            No packing items for this destination and season yet.
          </p>
        </T2Card>
      ) : (
        <>
          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {categoriesWithItems.map((cat) => {
              const catItems = items.filter((i) => i.category === cat)
              const done = catItems.filter((i) => checkedIds.has(i.id)).length
              const pct = catItems.length ? Math.round((done / catItems.length) * 100) : 0
              const active = cat === activeCategory
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`shrink-0 rounded-xl border px-3 py-2 text-left transition ${
                    active
                      ? 'border-amber-500/60 bg-amber-500/10 text-amber-300'
                      : 'border-neutral-800 bg-neutral-900 text-neutral-400 hover:border-neutral-700'
                  }`}
                >
                  <span className="block text-xs font-semibold">
                    {CATEGORY_LABELS[cat].en}
                  </span>
                  <span className="block text-[10px] text-neutral-500">
                    {CATEGORY_LABELS[cat].th}
                  </span>
                  <span className="mt-1 block text-[10px] tabular-nums">
                    {pct}% · {done}/{catItems.length}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-500">
            <span>
              {CATEGORY_LABELS[activeCategory].en} progress
            </span>
            <span className="tabular-nums text-amber-400/90">{categoryPct}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-neutral-800">
            <div
              className="h-full rounded-full bg-amber-500/80 transition-all"
              style={{ width: `${categoryPct}%` }}
            />
          </div>

          {mustHave.length > 0 && (
            <PackingSection
              title="Must have"
              subtitle="จำเป็นต้องมี"
              items={mustHave}
              checkedIds={checkedIds}
              onToggle={toggleItem}
            />
          )}

          {niceToHave.length > 0 && (
            <PackingSection
              title="Nice to have"
              subtitle="มีก็ดี"
              items={niceToHave}
              checkedIds={checkedIds}
              onToggle={toggleItem}
            />
          )}
        </>
      )}
    </div>
  )
}

function PackingSection({
  title,
  subtitle,
  items,
  checkedIds,
  onToggle,
}: {
  title: string
  subtitle: string
  items: PackingItemRow[]
  checkedIds: Set<string>
  onToggle: (id: string) => void
}) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-semibold text-neutral-200">
        {title}
        <span className="ml-2 text-xs font-normal text-neutral-500">{subtitle}</span>
      </h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const checked = checkedIds.has(item.id)
          return (
            <li key={item.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 transition ${
                  checked
                    ? 'border-amber-500/30 bg-amber-500/5'
                    : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(item.id)}
                  className="mt-1 h-4 w-4 shrink-0 rounded border-neutral-600 bg-neutral-800 text-amber-500 focus:ring-amber-500/50"
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm font-medium ${
                      checked ? 'text-neutral-500 line-through' : 'text-neutral-100'
                    }`}
                  >
                    {item.label_en}
                  </span>
                  <span className="block text-xs text-neutral-500">{item.label_th}</span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
