import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const OPENWEATHER_API_KEY = Deno.env.get('OPENWEATHER_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const CACHE_TTL_MS = 30 * 60 * 1000

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const DEST_TO_CITY: Record<string, string> = {
  NZ: 'Auckland',
  'NEW ZEALAND': 'Auckland',
  'New Zealand': 'Auckland',
  SYD: 'Sydney',
  SYDNEY: 'Sydney',
  Sydney: 'Sydney',
}

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  Auckland: { lat: -36.8485, lon: 174.7633 },
  Sydney: { lat: -33.8688, lon: 151.2093 },
}

const CONDITION_TH: Record<string, string> = {
  Clear: 'ท้องฟ้าแจ่มใส',
  Clouds: 'มีเมฆมาก',
  Rain: 'ฝนตก',
  Drizzle: 'ฝนปรอย',
  Thunderstorm: 'พายุฝนฟ้าคะนอง',
  Snow: 'หิมะตก',
  Mist: 'หมอก',
  Fog: 'หมอกหนา',
  Haze: 'หมอกควัน',
}

interface WeatherBody {
  dest?: string
  city?: string
}

interface WeatherSnapshot {
  city: string
  temp_c: number
  feels_like_c: number
  humidity: number
  wind_kph: number
  condition_en: string
  condition_th: string
  icon: string
  fetched_at: string
}

function resolveCity(body: WeatherBody): string {
  if (body.city?.trim()) return body.city.trim()
  const dest = body.dest?.trim()
  if (!dest) return 'Auckland'
  return DEST_TO_CITY[dest] ?? DEST_TO_CITY[dest.toUpperCase()] ?? dest
}

function dateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

function cacheKey(city: string, dest?: string): string {
  const d = dateKey()
  return dest ? `${dest}_${city}_${d}` : `${city}_${d}`
}

async function fetchOpenWeather(city: string): Promise<WeatherSnapshot> {
  const coords = CITY_COORDS[city]
  if (!coords) {
    throw new Error(`Unknown city: ${city}`)
  }
  if (!OPENWEATHER_API_KEY) {
    throw new Error('OPENWEATHER_API_KEY not configured')
  }

  const url = new URL('https://api.openweathermap.org/data/2.5/weather')
  url.searchParams.set('lat', String(coords.lat))
  url.searchParams.set('lon', String(coords.lon))
  url.searchParams.set('appid', OPENWEATHER_API_KEY)
  url.searchParams.set('units', 'metric')

  const res = await fetch(url.toString())
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenWeather error: ${text}`)
  }

  const data = await res.json()
  const main = data.weather?.[0]?.main ?? 'Unknown'
  const description = data.weather?.[0]?.description ?? main
  const icon = data.weather?.[0]?.icon ?? ''

  return {
    city,
    temp_c: Number(data.main?.temp ?? 0),
    feels_like_c: Number(data.main?.feels_like ?? data.main?.temp ?? 0),
    humidity: Number(data.main?.humidity ?? 0),
    wind_kph: Math.round(Number(data.wind?.speed ?? 0) * 3.6),
    condition_en: description,
    condition_th: CONDITION_TH[main] ?? description,
    icon,
    fetched_at: new Date().toISOString(),
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = (await req.json().catch(() => ({}))) as WeatherBody
    const city = resolveCity(body)
    const dest = body.dest?.trim() ?? null
    const key = cacheKey(city, dest ?? undefined)

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      const { data: cached } = await admin
        .from('weather_cache')
        .select('payload, expires_at')
        .eq('cache_key', key)
        .maybeSingle()

      if (cached?.payload && cached.expires_at && new Date(cached.expires_at) > new Date()) {
        return new Response(JSON.stringify(cached.payload), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const snapshot = await fetchOpenWeather(city)
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS).toISOString()

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
      await admin.from('weather_cache').upsert({
        cache_key: key,
        dest,
        city,
        payload: snapshot,
        fetched_at: snapshot.fetched_at,
        expires_at: expiresAt,
      })
    }

    return new Response(JSON.stringify(snapshot), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
