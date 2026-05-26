import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useClientSession } from '../hooks/useClientSession'
import { supabase } from '../lib/supabase'
import type { ClientGuideContentRow, GuideTabType } from '../types/missing_tables'
import type { TourDestination } from '../types/tour'
import Trip2TalkLogo from '../components/Trip2TalkLogo'
import { TRIP2TALK_PIXIESET_URL } from '../lib/trip2talkLinks'
import { isGoldCoastDestination } from '../lib/tripFilters'
import './ClientApp.css'

const TABS: { id: GuideTabType; label: string; icon: string }[] = [
  { id: 'content', label: 'GUIDE', icon: '▣' },
  { id: 'photo', label: 'PHOTO', icon: '◈' },
  { id: 'location', label: 'MAP', icon: '◎' },
  { id: 'food', label: 'FOOD', icon: '◆' },
]

function DestBadge({ dest }: { dest: string }) {
  return (
    <span className="rounded border border-[#C9A84C]/40 bg-[#C9A84C]/10 px-2 py-0.5 text-[9px] uppercase tracking-widest text-[#C9A84C]">
      {dest}
    </span>
  )
}

function DifficultyBadge({ level }: { level: string }) {
  const n = level.toLowerCase()
  const color =
    n.includes('hard') || n.includes('difficult')
      ? '#c97a7a'
      : n.includes('moderate') || n.includes('medium')
        ? '#e8c96a'
        : '#c9a84c'
  return (
    <span
      className="rounded border px-2 py-0.5 text-[9px] uppercase tracking-wide"
      style={{
        color,
        borderColor: `${color}55`,
        boxShadow: `0 0 8px ${color}44`,
      }}
    >
      {level}
    </span>
  )
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function strList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
}

function activeTabShowsThumb(tab: GuideTabType): boolean {
  return tab === 'photo' || tab === 'food'
}

function NeonPanel({ children, className = '', glow }: { children: ReactNode; className?: string; glow?: boolean }) {
  return (
    <div className={`client-neon__panel rounded-lg ${glow ? 'client-neon__card-open' : ''} ${className}`}>
      {children}
    </div>
  )
}

function SkeletonNeon() {
  return <div className="client-neon__skeleton h-28 rounded-lg" />
}

function GuideCard({ row, defaultOpen }: { row: ClientGuideContentRow; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false)
  const p = row.payload
  const body = str(p.body) ?? str(p.body_en) ?? str(p.body_th)
  const imageUrl = str(p.imageUrl) ?? str(p.image_url)
  const tips = strList(p.tips)
  const difficulty = str(p.difficulty) ?? str(p.difficulty_en)
  const subtitle = str(p.subtitle) ?? str(p.subtitle_en)

  return (
    <NeonPanel className="overflow-hidden" glow={open}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-start gap-3 p-4 text-left transition active:scale-[0.99]"
      >
        {imageUrl && activeTabShowsThumb(row.tab_type) && (
          <img
            src={imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded object-cover ring-1 ring-[#C9A84C]/40"
            style={{ boxShadow: '0 0 12px rgba(0, 245, 255, 0.25)' }}
          />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <DestBadge dest={row.dest} />
            {difficulty && <DifficultyBadge level={difficulty} />}
          </div>
          <h3 className={`mt-2 text-sm font-bold uppercase tracking-wide font-display ${open ? 'text-[#E8C96A]' : 'text-[#C9A84C]'}`}>
            {row.title_en}
          </h3>
          <p className="mt-1 text-xs text-[#8899aa]">{row.title_th}</p>
          {subtitle && !open && (
            <p className="mt-1 line-clamp-2 text-[10px] text-[#667788]">{subtitle}</p>
          )}
        </div>
        <span className="text-[#8A8070]">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="border-t border-[#2a2520] px-4 pb-4 pt-3">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={row.title_en}
              className="mb-3 w-full rounded object-cover ring-1 ring-[#C9A84C]/30"
              style={{ boxShadow: '0 0 20px rgba(255, 45, 149, 0.2)' }}
            />
          )}
          {body && <p className="text-xs leading-relaxed text-[#c8d8e8]">{body}</p>}
          {str(p.body_th) && str(p.body_en) !== str(p.body_th) && (
            <p className="mt-2 text-xs text-[#8899aa]">{str(p.body_th)}</p>
          )}
          {tips.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {tips.map((tip, i) => (
                <li key={i} className="flex gap-2 text-xs">
                  <span className="text-[#E8C96A]">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-[#F5F0E8]">{tip}</span>
                </li>
              ))}
            </ul>
          )}
          {typeof p.lat === 'number' && typeof p.lng === 'number' && (
            <p className="mt-3 text-[10px] text-[#8A8070]">
              {p.lat.toFixed(4)} · {p.lng.toFixed(4)}
            </p>
          )}
          {str(p.address) && <p className="mt-1 text-[10px] text-[#8899aa]">{str(p.address)}</p>}
        </div>
      )}
    </NeonPanel>
  )
}

export default function ClientApp() {
  const { client, tour, displayDestination, loading: sessionLoading } = useClientSession()
  const destination = displayDestination
  const [activeTab, setActiveTab] = useState<GuideTabType>('content')
  const [rows, setRows] = useState<ClientGuideContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadContent = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let query = supabase
        .from('client_guide_content')
        .select('*')
        .eq('tab_type', activeTab)
        .order('sort_order', { ascending: true })

      if (destination) {
        query = query.eq('dest', destination)
      }

      const { data, error: qErr } = await query
      if (qErr) throw new Error(qErr.message)

      const list = (data ?? []) as ClientGuideContentRow[]
      setRows(
        list.filter(
          (r) => r.active !== false && !isGoldCoastDestination(String(r.dest ?? ''))
        )
      )
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load guide')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, destination])

  useEffect(() => {
    if (sessionLoading) return
    void loadContent()
  }, [sessionLoading, loadContent])

  const clientName = client
    ? `${client.first_name_en} ${client.last_name_en}`.trim()
    : null

  return (
    <div className="client-neon min-h-full pb-4">
      <div className="client-neon__grid" aria-hidden />
      <div className="client-neon__scanlines" aria-hidden />

      <div className="client-neon__inner">
        <header className="client-neon__panel sticky top-0 z-40 mx-3 mt-3 rounded-lg px-4 py-4">
          <div className="flex items-center gap-3">
            <Trip2TalkLogo size="nav" />
            <p className="text-[9px] uppercase tracking-[0.35em] text-[#8A8070]">
              TRIP2TALK · GUIDE
            </p>
          </div>
          <h1 className="font-display mt-2 text-lg font-bold tracking-wide text-[#F5F0E8]">
            {clientName ?? 'CLIENT_GUIDE'}
          </h1>
          {tour ? (
            <p className="mt-2 text-[10px] text-[#C9A84C]">
              [{tour.trip_code}] {tour.destination} · {tour.start_date}
            </p>
          ) : (
            <p className="mt-2 text-[10px] leading-relaxed text-[#8A8070]">
              {destination ? `FILTER::${destination}` : 'ALL_DESTINATIONS'}
              {!destination && (
                <a
                  href={TRIP2TALK_PIXIESET_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 block text-[#C9A84C] underline underline-offset-2"
                >
                  Explore upcoming trips →
                </a>
              )}
            </p>
          )}
        </header>

        <nav className="sticky top-[108px] z-30 mx-3 mt-3" aria-label="Guide sections">
          <div className="client-neon__panel flex gap-1 overflow-x-auto rounded-lg p-1 scrollbar-none">
            {TABS.map((tab) => {
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-[4.5rem] shrink-0 flex-col items-center rounded px-3 py-2.5 transition active:scale-95 ${
                    active ? 'client-neon__tab-active' : 'text-[#556677] hover:text-[#8899aa]'
                  }`}
                >
                  <span className={`text-base leading-none ${active ? 'client-neon__glow-cyan' : ''}`}>
                    {tab.icon}
                  </span>
                  <span className="mt-1 text-[9px] font-bold tracking-widest">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        <main className="space-y-3 px-3 py-4">
          {(sessionLoading || loading) && (
            <>
              <SkeletonNeon />
              <SkeletonNeon />
              <SkeletonNeon />
            </>
          )}

          {!sessionLoading && !loading && error && (
            <NeonPanel className="p-4">
              <p className="text-xs text-[#c97a7a]">ERR::{error}</p>
              <button
                type="button"
                onClick={() => void loadContent()}
                className="mt-3 text-xs uppercase tracking-widest text-[#C9A84C] transition active:scale-95"
              >
                [ RETRY ]
              </button>
            </NeonPanel>
          )}

          {!sessionLoading && !loading && !error && rows.length === 0 && (
            <NeonPanel className="p-6">
              <p className="text-center text-xs text-[#8899aa]">
                NO_DATA::{activeTab}
                {destination ? `::${destination}` : ''}
              </p>
            </NeonPanel>
          )}

          {!sessionLoading &&
            !loading &&
            !error &&
            rows.map((row, i) => (
              <GuideCard key={row.id} row={row} defaultOpen={i === 0 && activeTab === 'content'} />
            ))}
        </main>

        {destination && (
          <footer className="px-4 pb-2 text-center">
            <DestBadge dest={destination as TourDestination} />
          </footer>
        )}
      </div>
    </div>
  )
}
