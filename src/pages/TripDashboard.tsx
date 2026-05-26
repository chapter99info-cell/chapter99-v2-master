import { useCallback, useEffect, useMemo, useState } from 'react'
import ConsentModal, { hasTripConsent } from '../components/ConsentModal'
import { supabase } from '../lib/supabase'
import {
  fetchEmergencyContacts,
  fetchItinerary,
  fetchOfflineMapPins,
  subscribeToItinerary,
} from '../lib/missingTablesQueries'
import { useClientSession } from '../hooks/useClientSession'
import { isGoldCoastTour } from '../lib/tripFilters'
import { T2Button, T2Card, SkeletonCard } from '../components/trip2talk/Trip2TalkShell'
import { TRIP2TALK_PIXIESET_URL } from '../lib/trip2talkLinks'
import type {
  EmergencyContactRow,
  ItineraryBlockRow,
  ItineraryBundle,
  ItineraryDayRow,
  MapPinCategory,
  OfflineMapPinRow,
  WeatherSnapshot,
} from '../types/missing_tables'
import type { StaffProfile, Tour, TourBooking, TourDestination } from '../types/tour'

type TabId = 'itinerary' | 'weather' | 'map' | 'emergency'

interface BookingHeader {
  booking: TourBooking
  tour: Tour
  guide: StaffProfile | null
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'itinerary', label: 'Itinerary' },
  { id: 'weather', label: 'Weather' },
  { id: 'map', label: 'Map' },
  { id: 'emergency', label: 'Emergency' },
]

const WEATHER_TTL_MS = 30 * 60 * 1000

const CATEGORY_LABELS: Record<MapPinCategory, string> = {
  hotel: 'Hotels',
  attraction: 'Attractions',
  transport: 'Transport',
  food: 'Food',
  emergency: 'Emergency',
  other: 'Other',
}

function destinationCity(dest: TourDestination | string): string {
  switch (dest) {
    case 'New Zealand':
      return 'Auckland'
    case 'Sydney':
      return 'Sydney'
    default:
      return String(dest)
  }
}

function dateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function dayNumberFromStart(startDate: string, ref = new Date()): number {
  const start = new Date(`${startDate}T12:00:00`)
  const today = new Date(`${dateKey(ref)}T12:00:00`)
  const diff = Math.floor((today.getTime() - start.getTime()) / 86_400_000)
  return diff + 1
}

function blockTypeLabel(type: ItineraryBlockRow['block_type']): string {
  const map: Record<ItineraryBlockRow['block_type'], string> = {
    travel: 'Travel',
    activity: 'Activity',
    meal: 'Meal',
    free: 'Free time',
    checkin: 'Check-in',
  }
  return map[type] ?? type
}

export default function TripDashboard() {
  const {
    clientId,
    booking,
    tour,
    displayTour,
    publicTours,
    loading: sessionLoading,
  } = useClientSession()
  const [pickedTourId, setPickedTourId] = useState<string | null>(null)
  const [consentOk, setConsentOk] = useState(hasTripConsent)
  const [tab, setTab] = useState<TabId>('itinerary')
  const [header, setHeader] = useState<BookingHeader | null>(null)
  const [headerLoading, setHeaderLoading] = useState(true)

  const [itinerary, setItinerary] = useState<ItineraryBundle | null>(null)
  const [itineraryLoading, setItineraryLoading] = useState(false)
  const [selectedDayId, setSelectedDayId] = useState<string | null>(null)
  const [dayTouched, setDayTouched] = useState(false)

  const [weather, setWeather] = useState<WeatherSnapshot | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)

  const [pins, setPins] = useState<OfflineMapPinRow[]>([])
  const [pinsLoading, setPinsLoading] = useState(false)
  const [copyId, setCopyId] = useState<string | null>(null)

  const [contacts, setContacts] = useState<EmergencyContactRow[]>([])
  const [contactsLoading, setContactsLoading] = useState(false)

  const pickedTour = pickedTourId
    ? publicTours.find((t) => t.id === pickedTourId) ?? null
    : null

  const activeTour = tour ?? header?.tour ?? pickedTour ?? displayTour ?? null
  const dest = activeTour?.destination ?? null
  const tourId = activeTour?.id ?? booking?.tour_id ?? null

  const loadHeader = useCallback(async () => {
    if (!clientId) {
      setHeader(null)
      setHeaderLoading(false)
      return
    }
    setHeaderLoading(true)
    const { data, error } = await supabase
      .from('tour_bookings')
      .select(
        `
        id, tour_id, client_id, guide_id, booking_status, amount_paid_aud, created_at,
        tours (
          id, trip_code, destination, start_date, end_date, price_aud, max_pax,
          current_pax, status, base_commission_rate, bonus_threshold_pax, bonus_amount_aud
        ),
        guide:staff_profiles!guide_id (id, full_name, role, phone, email, active)
      `
      )
      .eq('client_id', clientId)
      .eq('booking_status', 'FULLY_PAID')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) {
      setHeader(null)
      setHeaderLoading(false)
      return
    }

    const raw = data as Record<string, unknown>
    const toursRaw = raw.tours
    const guideRaw = raw.guide
    const tourRow = (Array.isArray(toursRaw) ? toursRaw[0] : toursRaw) as Tour | null
    const guideRow = (Array.isArray(guideRaw) ? guideRaw[0] : guideRaw) as StaffProfile | null
    if (!tourRow || isGoldCoastTour(tourRow)) {
      setHeader(null)
      setHeaderLoading(false)
      return
    }

    setHeader({
      booking: {
        id: raw.id as string,
        tour_id: raw.tour_id as string,
        client_id: raw.client_id as string,
        guide_id: raw.guide_id as string | null,
        booking_status: raw.booking_status as TourBooking['booking_status'],
        amount_paid_aud: raw.amount_paid_aud as number,
        created_at: raw.created_at as string | undefined,
      },
      tour: tourRow,
      guide: guideRow,
    })
    setHeaderLoading(false)
  }, [clientId])

  useEffect(() => {
    void loadHeader()
  }, [loadHeader])

  useEffect(() => {
    if (tour || pickedTourId || !publicTours.length) return
    setPickedTourId(publicTours[0].id)
  }, [tour, pickedTourId, publicTours])

  const loadItinerary = useCallback(async () => {
    if (!tourId) return
    setItineraryLoading(true)
    try {
      const bundle = await fetchItinerary(tourId)
      setItinerary(bundle)
    } catch {
      setItinerary({ days: [], blocks: [] })
    } finally {
      setItineraryLoading(false)
    }
  }, [tourId])

  useEffect(() => {
    void loadItinerary()
  }, [loadItinerary])

  useEffect(() => {
    if (!tourId) return
    return subscribeToItinerary(tourId, () => {
      void loadItinerary()
    })
  }, [tourId, loadItinerary])

  useEffect(() => {
    if (!itinerary?.days.length || !activeTour || dayTouched) return
    const todayNum = dayNumberFromStart(activeTour.start_date)
    const clamped = Math.min(
      Math.max(todayNum, 1),
      itinerary.days[itinerary.days.length - 1]?.day_number ?? 1
    )
    const match =
      itinerary.days.find((d) => d.day_number === clamped) ?? itinerary.days[0]
    setSelectedDayId(match.id)
  }, [itinerary, activeTour, dayTouched])

  const selectedDay = useMemo(() => {
    if (!itinerary || !selectedDayId) return null
    return itinerary.days.find((d) => d.id === selectedDayId) ?? null
  }, [itinerary, selectedDayId])

  const dayBlocks = useMemo(() => {
    if (!itinerary || !selectedDayId) return []
    return itinerary.blocks
      .filter((b) => b.day_id === selectedDayId)
      .sort((a, b) => a.sort_order - b.sort_order || a.start_time.localeCompare(b.start_time))
  }, [itinerary, selectedDayId])

  const loadWeather = useCallback(
    async (force = false) => {
      if (!dest) return
      const city = destinationCity(dest)
      const key = `weather_${dest}_${dateKey()}`
      if (!force) {
        try {
          const raw = localStorage.getItem(key)
          if (raw) {
            const cached = JSON.parse(raw) as WeatherSnapshot & { cached_at?: number }
            if (cached.cached_at && Date.now() - cached.cached_at < WEATHER_TTL_MS) {
              setWeather(cached)
              setWeatherError(null)
              return
            }
          }
        } catch {
          /* ignore corrupt cache */
        }
      }

      setWeatherLoading(true)
      setWeatherError(null)
      try {
        const { data, error } = await supabase.functions.invoke('get-weather', {
          body: { city },
        })
        if (error) throw new Error(error.message)
        const payload = (data ?? {}) as WeatherSnapshot
        const snapshot: WeatherSnapshot = {
          city: payload.city ?? city,
          temp_c: Number(payload.temp_c ?? 0),
          feels_like_c: Number(payload.feels_like_c ?? payload.temp_c ?? 0),
          humidity: Number(payload.humidity ?? 0),
          wind_kph: Number(payload.wind_kph ?? 0),
          condition_en: payload.condition_en ?? '—',
          condition_th: payload.condition_th ?? payload.condition_en ?? '—',
          icon: payload.icon ?? '',
          fetched_at: payload.fetched_at ?? new Date().toISOString(),
        }
        localStorage.setItem(
          key,
          JSON.stringify({ ...snapshot, cached_at: Date.now() })
        )
        setWeather(snapshot)
      } catch (e) {
        setWeatherError(e instanceof Error ? e.message : 'Weather unavailable')
      } finally {
        setWeatherLoading(false)
      }
    },
    [dest]
  )

  useEffect(() => {
    if (tab !== 'weather' || !dest) return
    void loadWeather()
    const id = window.setInterval(() => void loadWeather(true), WEATHER_TTL_MS)
    return () => window.clearInterval(id)
  }, [tab, dest, loadWeather])

  const loadPins = useCallback(async () => {
    if (!dest) return
    const cacheKey = `map_pins_${dest}`
    try {
      const raw = localStorage.getItem(cacheKey)
      if (raw) {
        const cached = JSON.parse(raw) as OfflineMapPinRow[]
        if (cached.length) setPins(cached)
      }
    } catch {
      /* ignore */
    }

    setPinsLoading(true)
    try {
      const rows = await fetchOfflineMapPins(dest)
      setPins(rows)
      localStorage.setItem(cacheKey, JSON.stringify(rows))
    } catch {
      setPins((prev) => (prev.length ? prev : []))
    } finally {
      setPinsLoading(false)
    }
  }, [dest])

  useEffect(() => {
    if (tab === 'map') void loadPins()
  }, [tab, loadPins])

  const pinsByCategory = useMemo(() => {
    const groups = new Map<MapPinCategory, OfflineMapPinRow[]>()
    for (const pin of pins) {
      const list = groups.get(pin.category) ?? []
      list.push(pin)
      groups.set(pin.category, list)
    }
    return groups
  }, [pins])

  const loadContacts = useCallback(async () => {
    if (!dest) return
    setContactsLoading(true)
    try {
      const rows = await fetchEmergencyContacts(dest)
      setContacts(rows)
    } catch {
      setContacts([])
    } finally {
      setContactsLoading(false)
    }
  }, [dest])

  useEffect(() => {
    if (tab === 'emergency') void loadContacts()
  }, [tab, loadContacts])

  async function copyAddress(pin: OfflineMapPinRow) {
    try {
      await navigator.clipboard.writeText(pin.address)
      setCopyId(pin.id)
      window.setTimeout(() => setCopyId(null), 2000)
    } catch {
      setCopyId(null)
    }
  }

  if (sessionLoading || (clientId && headerLoading)) {
    return (
      <div className="space-y-4 p-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  if (!activeTour) {
    return (
      <div className="p-4">
        <T2Card>
          <p className="text-center text-sm text-[#8A8070]">
            ยังไม่มีทริปที่เปิดรับสมัคร — ดูแกลเลอรี่และจองทริปจากพี่แสน
          </p>
          <div className="mt-4">
            <T2Button
              onClick={() =>
                window.open(`${TRIP2TALK_PIXIESET_URL}/`, '_blank', 'noopener,noreferrer')
              }
            >
              Explore upcoming trips
            </T2Button>
          </div>
        </T2Card>
      </div>
    )
  }

  const guide = header?.guide
  const todayDayNum = dayNumberFromStart(activeTour.start_date)
  const needsConsent = Boolean(clientId && booking)

  if (needsConsent && !consentOk) {
    return (
      <ConsentModal
        tripId={tourId ?? activeTour.id}
        onAccepted={() => setConsentOk(true)}
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-col pb-4">
      <header className="border-b border-neutral-800 bg-neutral-950/90 px-4 pb-4 pt-5 backdrop-blur">
        <p className="font-mono text-xs uppercase tracking-wider text-amber-400">
          {activeTour.trip_code}
        </p>
        <h1 className="mt-1 text-xl font-semibold text-neutral-50">
          {activeTour.destination}
        </h1>
        <p className="mt-1 text-sm text-neutral-400">
          {formatDateRange(activeTour.start_date, activeTour.end_date)}
        </p>
        {!tour && publicTours.length > 0 && (
          <div className="mt-3">
            <label htmlFor="trip-picker" className="text-xs text-neutral-500">
              Upcoming trips
            </label>
            <select
              id="trip-picker"
              className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
              value={pickedTourId ?? activeTour.id}
              onChange={(e) => setPickedTourId(e.target.value)}
            >
              {publicTours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trip_code} · {t.destination} · {t.start_date}
                </option>
              ))}
            </select>
          </div>
        )}
        {guide && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/80 px-3 py-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-400">
              {guide.full_name.charAt(0)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-neutral-500">Your guide</p>
              <p className="truncate font-medium text-neutral-100">{guide.full_name}</p>
              {guide.phone && (
                <a
                  href={`tel:${sanitizeTel(guide.phone)}`}
                  className="text-sm text-amber-400 hover:underline"
                >
                  {guide.phone}
                </a>
              )}
            </div>
          </div>
        )}
      </header>

      <nav className="sticky top-0 z-10 flex gap-1 border-b border-neutral-800 bg-neutral-950 px-2 py-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition active:scale-95 ${
              tab === t.id
                ? 'bg-amber-500/15 text-amber-400'
                : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <div className="flex-1 space-y-4 p-4">
        {tab === 'itinerary' && (
          <ItineraryPanel
            loading={itineraryLoading}
            days={itinerary?.days ?? []}
            selectedDayId={selectedDayId}
            selectedDay={selectedDay}
            blocks={dayBlocks}
            todayDayNum={todayDayNum}
            onSelectDay={(id) => {
              setDayTouched(true)
              setSelectedDayId(id)
            }}
          />
        )}

        {tab === 'weather' && (
          <WeatherPanel
            dest={dest}
            weather={weather}
            loading={weatherLoading}
            error={weatherError}
            onRefresh={() => void loadWeather(true)}
          />
        )}

        {tab === 'map' && (
          <MapPanel
            loading={pinsLoading}
            pinsByCategory={pinsByCategory}
            copyId={copyId}
            onCopy={copyAddress}
          />
        )}

        {tab === 'emergency' && (
          <EmergencyPanel
            loading={contactsLoading}
            guide={guide}
            contacts={contacts}
          />
        )}
      </div>
    </div>
  )
}

function ItineraryPanel({
  loading,
  days,
  selectedDayId,
  selectedDay,
  blocks,
  todayDayNum,
  onSelectDay,
}: {
  loading: boolean
  days: ItineraryDayRow[]
  selectedDayId: string | null
  selectedDay: ItineraryDayRow | null
  blocks: ItineraryBlockRow[]
  todayDayNum: number
  onSelectDay: (id: string) => void
}) {
  if (loading) {
    return (
      <>
        <SkeletonCard />
        <SkeletonCard />
      </>
    )
  }

  if (!days.length) {
    return (
      <T2Card>
        <p className="text-center text-sm text-neutral-400">
          Itinerary will appear here once your guide publishes the schedule.
        </p>
      </T2Card>
    )
  }

  return (
    <>
      <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {days.map((d) => {
          const isToday = d.day_number === todayDayNum
          const active = d.id === selectedDayId
          return (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDay(d.id)}
              className={`shrink-0 rounded-xl border px-3 py-2 text-left transition active:scale-95 ${
                active
                  ? 'border-amber-500/60 bg-amber-500/10 text-amber-400'
                  : 'border-neutral-800 bg-neutral-900 text-neutral-400'
              }`}
            >
              <span className="font-mono text-xs">Day {d.day_number}</span>
              {isToday && (
                <span className="ml-1 text-[10px] uppercase text-amber-400">Today</span>
              )}
            </button>
          )
        })}
      </div>

      {selectedDay && (
        <T2Card>
          <h2 className="font-semibold text-neutral-50">{selectedDay.title_en}</h2>
          <p className="text-sm text-neutral-500">{selectedDay.title_th}</p>
          {selectedDay.summary_en && (
            <p className="mt-2 text-sm text-neutral-400">{selectedDay.summary_en}</p>
          )}
        </T2Card>
      )}

      <div className="space-y-3">
        {blocks.length === 0 ? (
          <T2Card>
            <p className="text-sm text-neutral-500">No activities scheduled for this day.</p>
          </T2Card>
        ) : (
          blocks.map((b) => (
            <T2Card key={b.id} className="border-l-4 border-l-amber-500/40">
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs text-amber-400">
                  {b.start_time.slice(0, 5)}
                  {b.end_time ? ` – ${b.end_time.slice(0, 5)}` : ''}
                </span>
                <span className="rounded-md bg-neutral-800 px-2 py-0.5 text-[10px] uppercase tracking-wide text-neutral-400">
                  {blockTypeLabel(b.block_type)}
                </span>
              </div>
              <h3 className="mt-2 font-medium text-neutral-100">{b.title_en}</h3>
              <p className="text-sm text-neutral-500">{b.title_th}</p>
              {b.location_name && (
                <p className="mt-2 text-sm text-neutral-400">📍 {b.location_name}</p>
              )}
              {b.notes_en && (
                <p className="mt-1 text-xs text-neutral-500">{b.notes_en}</p>
              )}
            </T2Card>
          ))
        )}
      </div>
    </>
  )
}

function WeatherPanel({
  dest,
  weather,
  loading,
  error,
  onRefresh,
}: {
  dest: TourDestination | string | null
  weather: WeatherSnapshot | null
  loading: boolean
  error: string | null
  onRefresh: () => void
}) {
  if (!dest) {
    return (
      <T2Card>
        <p className="text-sm text-neutral-400">Destination not set.</p>
      </T2Card>
    )
  }

  if (loading && !weather) {
    return <SkeletonCard />
  }

  return (
    <T2Card className="relative overflow-hidden">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-500/10 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-neutral-500">Today</p>
            <h2 className="text-lg font-semibold text-neutral-50">
              {destinationCity(dest)}
            </h2>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="rounded-lg border border-neutral-700 px-3 py-1 text-xs text-amber-400 transition active:scale-95 disabled:opacity-50"
          >
            {loading ? '…' : 'Refresh'}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-950/50 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        {weather && (
          <div className="mt-4">
            <p className="font-mono text-5xl font-light text-amber-400">
              {Math.round(weather.temp_c)}°
            </p>
            <p className="mt-1 text-neutral-300">{weather.condition_en}</p>
            <p className="text-sm text-neutral-500">{weather.condition_th}</p>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Feels" value={`${Math.round(weather.feels_like_c)}°`} />
              <Stat label="Humidity" value={`${weather.humidity}%`} />
              <Stat label="Wind" value={`${weather.wind_kph} km/h`} />
            </div>
            <p className="mt-3 text-[10px] text-neutral-600">
              Updated {new Date(weather.fetched_at).toLocaleTimeString()}
            </p>
          </div>
        )}
      </div>
    </T2Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-800/80 py-2">
      <p className="text-[10px] uppercase text-neutral-500">{label}</p>
      <p className="font-mono text-sm text-neutral-200">{value}</p>
    </div>
  )
}

function MapPanel({
  loading,
  pinsByCategory,
  copyId,
  onCopy,
}: {
  loading: boolean
  pinsByCategory: Map<MapPinCategory, OfflineMapPinRow[]>
  copyId: string | null
  onCopy: (pin: OfflineMapPinRow) => void
}) {
  if (loading && pinsByCategory.size === 0) {
    return <SkeletonCard />
  }

  if (pinsByCategory.size === 0) {
    return (
      <T2Card>
        <p className="text-sm text-neutral-400">Offline map pins are not available yet.</p>
      </T2Card>
    )
  }

  const order: MapPinCategory[] = [
    'hotel',
    'attraction',
    'transport',
    'food',
    'emergency',
    'other',
  ]

  return (
    <div className="space-y-5">
      {order.map((cat) => {
        const items = pinsByCategory.get(cat)
        if (!items?.length) return null
        return (
          <section key={cat}>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              {CATEGORY_LABELS[cat]}
            </h2>
            <div className="space-y-2">
              {items.map((pin) => (
                <T2Card key={pin.id} className="!p-3">
                  <p className="font-medium text-neutral-100">{pin.name_en}</p>
                  <p className="text-xs text-neutral-500">{pin.name_th}</p>
                  <p className="mt-2 text-sm text-neutral-400">{pin.address}</p>
                  {pin.notes_en && (
                    <p className="mt-1 text-xs text-neutral-600">{pin.notes_en}</p>
                  )}
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => void onCopy(pin)}
                      className="flex-1 rounded-lg border border-neutral-700 py-2 text-xs font-medium text-amber-400 transition active:scale-95 hover:border-amber-500/40"
                    >
                      {copyId === pin.id ? 'Copied!' : 'Copy address'}
                    </button>
                    {(pin.lat != null && pin.lng != null) && (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${pin.lat},${pin.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-300 transition active:scale-95"
                      >
                        Maps
                      </a>
                    )}
                  </div>
                </T2Card>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function EmergencyPanel({
  loading,
  guide,
  contacts,
}: {
  loading: boolean
  guide: StaffProfile | null
  contacts: EmergencyContactRow[]
}) {
  if (loading) {
    return <SkeletonCard />
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-900/80 bg-gradient-to-br from-red-950 to-neutral-950 px-4 py-4 shadow-[0_0_24px_rgba(220,38,38,0.25)]">
        <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-red-400">
          SOS — Emergency
        </p>
        <p className="mt-2 text-center text-sm text-red-200/90">
          Call 000 (Australia) or 111 (New Zealand) for life-threatening emergencies.
        </p>
        <div className="mt-3 flex justify-center gap-3">
          <a
            href="tel:000"
            className="rounded-xl bg-red-600 px-6 py-3 text-sm font-bold text-white shadow-lg transition active:scale-95 hover:bg-red-500"
          >
            Call 000
          </a>
          <a
            href="tel:111"
            className="rounded-xl border border-red-700 px-4 py-3 text-sm font-medium text-red-300 transition active:scale-95"
          >
            NZ 111
          </a>
        </div>
      </div>

      {guide?.phone && (
        <T2Card className="border-amber-500/30">
          <p className="text-xs uppercase text-amber-400">Your guide (first)</p>
          <p className="mt-1 font-medium text-neutral-100">{guide.full_name}</p>
          <a
            href={`tel:${sanitizeTel(guide.phone)}`}
            className="mt-2 inline-block font-mono text-lg text-amber-400 hover:underline"
          >
            {guide.phone}
          </a>
        </T2Card>
      )}

      <div className="space-y-2">
        {contacts.map((c) => (
          <T2Card
            key={c.id}
            className={c.is_oshc_tip ? 'border-emerald-800/50' : ''}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-medium text-neutral-100">{c.label_en}</p>
                <p className="text-xs text-neutral-500">{c.label_th}</p>
                {c.is_oshc_tip && (
                  <span className="mt-1 inline-block text-[10px] uppercase text-emerald-400">
                    OSHC tip
                  </span>
                )}
              </div>
              <a
                href={`tel:${sanitizeTel(c.phone)}`}
                className="shrink-0 rounded-xl bg-neutral-800 px-4 py-2 font-mono text-sm text-amber-400 transition active:scale-95 hover:bg-neutral-700"
              >
                Call
              </a>
            </div>
          </T2Card>
        ))}
      </div>
    </div>
  )
}

function formatDateRange(start: string, end: string): string {
  const fmt = (s: string) =>
    new Date(`${s}T12:00:00`).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
  return `${fmt(start)} – ${fmt(end)}`
}

function sanitizeTel(phone: string): string {
  return phone.replace(/[^\d+]/g, '')
}
