/**
 * Trip2Talk Admin — AI content generator (/admin/content-generator)
 *
 * -- Migration (run once in Supabase SQL editor):
 * CREATE TABLE gallery_posts (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   image_url text,
 *   location text,
 *   trip_type text,
 *   season text,
 *   template_a text,
 *   template_b text,
 *   template_c text,
 *   template_a_en text,
 *   template_b_en text,
 *   next_trip_date date,
 *   seats_remaining int,
 *   created_at timestamptz DEFAULT now()
 * );
 *
 * -- Bookings (see supabase/039_trip_bookings.sql):
 * CREATE TABLE IF NOT EXISTS trip_bookings ( ... );
 * -- Also create Storage bucket: gallery (public read for image_url)
 *
 * Env: VITE_ANTHROPIC_API_KEY (optional — falls back to local templates)
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import PinLogin from '../../components/PinLogin'
import Trip2TalkLogo from '../../components/Trip2TalkLogo'
import AdminBookings from './AdminBookings'
import {
  clearAdminSession,
  isAdminSessionValid,
  setAdminSession,
} from '../../lib/adminPinSession'
import { supabase } from '../../lib/supabase'
import {
  buildGalleryShareCaption,
  DEFAULT_TRIP_SHARE,
} from '../../lib/galleryShareCaption'

// ─── Trip catalogue ───────────────────────────────────────────────────────────

type TripKey =
  | 'melbourne'
  | 'tasmania'
  | 'uluru'
  | 'nz'
  | 'annabay'
  | 'bluemountains'
  | 'oberon'
  | 'helensburghkiama'
  | 'aurora'
type NzSeason = 'Summer' | 'Autumn' | 'Winter' | 'Spring'

interface TripBase {
  name: string
  duration: string
  maxPax: number
  route: string
}

interface TripTiered extends TripBase {
  priceStandard: number
  pricePro: number
  highlights: string[]
}

interface TripSinglePrice extends TripBase {
  price: number
  highlights: string[]
  depositPrice?: number
}

interface TripNz extends TripBase {
  price: number
  seasons: NzSeason[]
  highlights: Record<NzSeason, string[]>
}

type TripConfig = TripTiered | TripSinglePrice | TripNz

export const TRIPS: Record<TripKey, TripConfig> = {
  melbourne: {
    name: 'Melbourne',
    duration: '4 วัน 3 คืน',
    priceStandard: 1302,
    pricePro: 2102,
    maxPax: 5,
    route: 'Sydney → Melbourne',
    highlights: ['The Twelve Apostles', 'Pink Lake', 'Melbourne City', 'Great Ocean Road'],
  },
  tasmania: {
    name: 'Tasmania',
    duration: '4 วัน 3 คืน',
    priceStandard: 1302,
    pricePro: 2102,
    maxPax: 5,
    route: 'Sydney → Hobart',
    highlights: ['Cradle Mountain', 'Bruny Island', 'Mt Wellington', 'Aurora Hunting'],
  },
  uluru: {
    name: 'Uluru–Kata Tjuta',
    duration: '3 คืน 4 วัน',
    price: 1990,
    maxPax: 5,
    route: 'Sydney → Uluru',
    highlights: ['Uluru Sunrise/Sunset', 'Field of Light', 'Kata Tjuta', 'Cultural Walk'],
  },
  nz: {
    name: 'New Zealand South Island',
    duration: '6 วัน',
    price: 2300,
    maxPax: 5,
    route: 'Sydney → Christchurch',
    seasons: ['Summer', 'Autumn', 'Winter', 'Spring'],
    highlights: {
      Summer: ['Queenstown', 'Wanaka', 'Fox Glacier', 'Mt Cook', 'Milford Sound'],
      Autumn: ['Queenstown', 'Arrowtown', 'Wanaka', 'Lindis Pass', 'Milford Sound'],
      Winter: ['Queenstown', 'Te Anau', 'Milford Sound', 'Lake Pukaki', 'Mt John Observatory'],
      Spring: ['Nugget Point', 'Queenstown', 'Moeraki', 'Mt Cook', 'Lake Tekapo', 'Milford Sound'],
    },
  },
  annabay: {
    name: 'Anna Bay (1 Day)',
    duration: '1 วัน',
    price: 250,
    maxPax: 4,
    route: 'Sydney → Anna Bay',
    highlights: ['Sandboarding', 'Norah Head Lighthouse', 'Long Jetty', 'Camel Beach Walk'],
  },
  bluemountains: {
    name: 'Blue Mountains – Lavender & Heritage (1 Day)',
    duration: '1 วัน',
    price: 250,
    maxPax: 4,
    route: 'Sydney → Blue Mountains',
    highlights: ['Lavender Field', 'Zig Zag Railway', 'Lithgow', "Lincoln's Rock Golden Hour"],
  },
  oberon: {
    name: 'Oberon – Snow in the Forest (1 Day)',
    duration: '1 วัน',
    price: 250,
    maxPax: 4,
    route: 'Sydney → Oberon',
    highlights: ['Pine Forest', 'Snow Fields', 'Railway Tree Mountains', 'Oberon Hill'],
  },
  helensburghkiama: {
    name: 'Helensburgh – Kiama (1 Day)',
    duration: '1 วัน',
    price: 250,
    maxPax: 4,
    route: 'Sydney → Helensburgh → Kiama',
    highlights: ['Old Helensburgh Tunnel', 'Kiama Blowhole', 'Cathedral Rocks', 'Sunset Coast'],
  },
  aurora: {
    name: 'Aurora Hunting – Tasmania',
    duration: '3 วัน 2 คืน',
    price: 1302,
    depositPrice: 100,
    maxPax: 5,
    route: 'Sydney → Hobart',
    highlights: [
      'Aurora Australis Hunting',
      'Secret Spots Hobart',
      'Smartphone Mastery Workshop',
      'Darkest Skies Astrophotography',
    ],
  },
}

const HASHTAGS: Record<TripKey, string> = {
  melbourne:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #เที่ยวออสเตรเลีย #Melbourne #GreatOceanRoad #PinkLake #ถ่ายภาพออสเตรเลีย #คนไทยในออสเตรเลีย #Sydney #phototrip',
  tasmania:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #Tasmania #AuroraAustralis #ล่าแสงใต้ #เที่ยวออสเตรเลีย #CradleMountain #ถ่ายภาพออสเตรเลีย #คนไทยในออสเตรเลีย #phototrip',
  uluru:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #Uluru #FieldOfLight #KataTjuta #เที่ยวออสเตรเลีย #ทะเลทราย #ถ่ายภาพออสเตรเลีย #คนไทยในออสเตรเลีย #phototrip',
  nz: '#Trip2Talk #ทริปพร้อมช่างภาพ #NewZealand #นิวซีแลนด์ #MilfordSound #Queenstown #Wanaka #ถ่ายภาพนิวซีแลนด์ #คนไทยในออสเตรเลีย #phototrip',
  annabay:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #AnnaBay #OneDayTrip #Sandboarding #เที่ยวซิดนีย์ #คนไทยในออสเตรเลีย #Sydney #phototrip',
  bluemountains:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #BlueMountains #Lavender #OneDayTrip #เที่ยวซิดนีย์ #คนไทยในออสเตรเลีย #phototrip',
  oberon:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #Oberon #SnowInSydney #OneDayTrip #เที่ยวซิดนีย์ #คนไทยในออสเตรเลีย #phototrip',
  helensburghkiama:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #Helensburgh #Kiama #OneDayTrip #เที่ยวซิดนีย์ #คนไทยในออสเตรเลีย #phototrip',
  aurora:
    '#Trip2Talk #ทริปพร้อมช่างภาพ #AuroraAustralis #Tasmania #ล่าแสงใต้ #Astrophotography #คนไทยในออสเตรเลีย #phototrip',
}

function appendTemplateBHashtags(body: string, tripKey: TripKey): string {
  const tags = HASHTAGS[tripKey]
  const base = body.replace(/\n\n#Trip2Talk[\s\S]*$/u, '').trimEnd()
  return `${base}\n\n${tags}`
}

function applyTemplateBHashtags(templates: GeneratedTemplates, tripKey: TripKey): GeneratedTemplates {
  return { ...templates, templateB: appendTemplateBHashtags(templates.templateB, tripKey) }
}

type Lang = 'TH' | 'EN'

interface GeneratedTemplates {
  templateA: string
  templateB: string
  templateC: string
}

interface Toast {
  type: 'ok' | 'err'
  message: string
}

const ANTHROPIC_MODEL = 'claude-sonnet-4-20250514'

const SYSTEM_PROMPT_TH =
  'คุณเป็นผู้เชี่ยวชาญเขียนคอนเทนต์ท่องเที่ยวภาษาไทย สำหรับ Trip2Talk\n' +
  'พี่แสนคือช่างภาพไทยในซิดนีย์ที่พาลูกค้าออกทริปเอง — ขับรถเอง จองที่พักให้ และถ่ายภาพให้ตลอดทริป\n' +
  'ไม่ใช่ทัวร์ ไม่มีไกด์ แต่คือการออกทริปส่วนตัวกับช่างภาพตัวจริง\n' +
  'เขียนแบบเนียนขายทริป อารมณ์ดี เป็นกันเอง ไม่ formal'

const SYSTEM_PROMPT_EN =
  'You write travel marketing content in English for Trip2Talk.\n' +
  'Saen is a Thai photographer in Sydney who runs personal photo trips himself — ' +
  'he drives, books accommodation, and photographs guests throughout. Not a tour. No tour guide.\n' +
  'Friendly, casual tone. Reply as JSON only — no markdown or backticks.'

function isNzTrip(t: TripConfig): t is TripNz {
  return 'seasons' in t
}

function isTieredTrip(t: TripConfig): t is TripTiered {
  return 'priceStandard' in t
}

/** Price line for AI prompts and Template B */
function tripPriceForPrompt(t: TripConfig): string {
  if (isTieredTrip(t)) {
    return `Standard $${formatPromoPriceAud(t.priceStandard)}/คน | Pro $${formatPromoPriceAud(t.pricePro)}/คน`
  }
  const single = t as TripSinglePrice
  const base = `$${formatPromoPriceAud(single.price)}/คน`
  if (single.depositPrice != null) {
    return `${base} (มัดจำ $${formatPromoPriceAud(single.depositPrice)})`
  }
  return base
}

function formatPromoPriceAud(amount: number): string {
  return amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

function tripDayHighlightsBlock(t: TripConfig, season: NzSeason): string {
  const items = isNzTrip(t) ? t.highlights[season] : t.highlights
  return items.map((h, i) => `Day ${i + 1} · ${h}`).join('\n')
}

export function buildAnthropicUserPrompt(
  input: {
    location: string
    trip: TripConfig
    tripKey: TripKey
    season: NzSeason
    nextTripDate: string
    seats: number
  },
  lang: Lang = 'TH',
): string {
  const { location, trip, tripKey, season, nextTripDate, seats } = input
  const seasonLine = isNzTrip(trip) ? season : '—'
  const dateLine = nextTripDate || '—'
  const year = nextTripDate ? new Date(nextTripDate).getFullYear() : new Date().getFullYear()
  const country = regionForTrip(tripKey).split(',')[0]?.trim() ?? regionForTrip(tripKey)
  const flag = countryFlagEmoji(tripKey)
  const dayBlock = tripDayHighlightsBlock(trip, season)
  const price = tripPriceForPrompt(trip)
  const intro =
    lang === 'TH'
      ? 'วิเคราะห์รูปนี้แล้วเขียน 3 templates ภาษาไทย'
      : 'Analyze this photo and write 3 templates in English'

  const jsonSpec =
    lang === 'TH'
      ? `ตอบใน JSON เท่านั้น ห้ามมี markdown หรือ backticks:
{
  "templateA": "[Location] ✦ [Country]\\n[hook 1 ประโยคจากอารมณ์ของรูป]\\n📸 Trip2Talk [Season] [Year] · [Duration]",

  "templateB": "hook น่าสนใจ 1 ประโยคใส่ใน quote\\n\\n[บรรยาย 2-3 ประโยค เล่าความรู้สึก + จุดขายว่าพี่แสนพาไปเอง ขับรถเอง ถ่ายรูปให้]\\n\\n🗓 [TRIP_NAME] | [DURATION]\\n📍 [highlight แต่ละวัน Day 1–N]\\n👥 รับเพียง [MAXPAX] คน/ทริป\\n💰 $[PRICE]/คน\\n\\nสิ่งที่พี่แสนดูแลให้:\\n✅ ขับรถพาไปทุกจุด\\n✅ จองที่พักตลอดทริป\\n✅ ถ่ายภาพให้ตลอดเวลา\\n✅ Itinerary ออกแบบมาเพื่อแสงดีที่สุด\\n\\n🔗 trip2talk.com.au | 💬 ทักมาคุยก่อนได้เลย",

  "templateC": "[LOCATION] 📍 [Country flag emoji]\\n[1 ประโยคความรู้สึกจากรูป]\\n[TRIP_NAME] — เหลือ [SEATS] ที่นั่ง 👉 trip2talk.com.au"
}`
      : `Reply in JSON only — no markdown or backticks:
{
  "templateA": "[Location] ✦ [Country]\\n[one-line hook from the photo]\\n📸 Trip2Talk [Season] [Year] · [Duration]",

  "templateB": "interesting hook in quotes\\n\\n[2-3 sentences — feeling from photo + Saen drives, books stays, shoots for you, not a tour]\\n\\n🗓 [TRIP_NAME] | [DURATION]\\n📍 [Day 1–N highlights]\\n👥 Max [MAXPAX] guests\\n💰 [PRICE]/person\\n\\nWhat Saen handles:\\n✅ Drives to every location\\n✅ Books accommodation\\n✅ Photographs you throughout\\n✅ Itinerary designed for the best light\\n\\n🔗 trip2talk.com.au | 💬 Message to book",

  "templateC": "[LOCATION] 📍 [flag emoji]\\n[one feeling line]\\n[TRIP_NAME] — [SEATS] seats left 👉 trip2talk.com.au"
}`

  return (
    `${intro}\n\n` +
    `สถานที่ / Location: ${location}\n` +
    `ทริป / Trip: ${trip.name} ${trip.duration}\n` +
    `เส้นทาง / Route: ${trip.route}\n` +
    `ราคา / Price: ${price}\n` +
    `ฤดู / Season: ${seasonLine}\n` +
    `วันที่ทริปหน้า / Next trip: ${dateLine}\n` +
    `ที่นั่งเหลือ / Seats left: ${seats}\n` +
    `Max pax: ${trip.maxPax}\n` +
    `Year for template A: ${year}\n` +
    `Country flag for template C: ${flag}\n` +
    `Day highlights:\\n${dayBlock}\n\n` +
    `${jsonSpec}\n\n` +
    `Fill all placeholders with real copy from the image — do not leave brackets in the output.`
  )
}

function buildSaenTemplateB(params: {
  hook: string
  tripName: string
  duration: string
  dayBlock: string
  maxPax: number
  priceLine: string
}): string {
  return [
    `"${params.hook}"`,
    '',
    'พี่แสนพาเองทุกขั้นตอน — ขับรถ จองที่พัก ถ่ายรูปให้ตลอดทาง ไม่ใช่ทัวร์ทั่วไป แค่กลุ่มเล็กที่ได้โฟกัสจริงๆ',
    '',
    `🗓 ${params.tripName} | ${params.duration}`,
    `📍 ${params.dayBlock}`,
    `👥 รับเพียง ${params.maxPax} คน/ทริป`,
    `💰 ${params.priceLine}`,
    '',
    'สิ่งที่พี่แสนดูแลให้:',
    '✅ ขับรถพาไปทุกจุด',
    '✅ จองที่พักตลอดทริป',
    '✅ ถ่ายภาพให้ตลอดเวลา',
    '✅ Itinerary ออกแบบมาเพื่อแสงดีที่สุด',
    '',
    '🔗 trip2talk.com.au | 💬 ทักมาคุยก่อนได้เลย',
  ].join('\n')
}

function regionForTrip(key: TripKey): string {
  const regions: Record<TripKey, string> = {
    melbourne: 'Victoria, Australia',
    tasmania: 'Tasmania, Australia',
    uluru: 'Northern Territory, Australia',
    nz: 'New Zealand',
    annabay: 'Port Stephens, NSW, Australia',
    bluemountains: 'Blue Mountains, NSW, Australia',
    oberon: 'Oberon, NSW, Australia',
    helensburghkiama: 'South Coast, NSW, Australia',
    aurora: 'Tasmania, Australia',
  }
  return regions[key]
}

function countryFlagEmoji(tripKey: TripKey): string {
  return tripKey === 'nz' ? '🇳🇿' : '🇦🇺'
}

function parseTemplatesJson(raw: string): GeneratedTemplates {
  let trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) trimmed = fenced[1].trim()
  const jsonStart = trimmed.indexOf('{')
  const jsonEnd = trimmed.lastIndexOf('}')
  const jsonStr = jsonStart >= 0 && jsonEnd > jsonStart ? trimmed.slice(jsonStart, jsonEnd + 1) : trimmed
  const parsed = JSON.parse(jsonStr) as Record<string, unknown>
  const pick = (k: string) => String(parsed[k] ?? parsed[k.toLowerCase()] ?? '')
  return {
    templateA: pick('templateA'),
    templateB: pick('templateB'),
    templateC: pick('templateC'),
  }
}

const MAX_IMAGE_DIMENSION = 1920
const MAX_IMAGE_BYTES = 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function fitImageDimensions(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  if (width <= maxDim && height <= maxDim) return { width, height }
  const scale = maxDim / Math.max(width, height)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }
    img.src = url
  })
}

function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('JPEG compression failed'))),
      'image/jpeg',
      quality,
    )
  })
}

/** Resize (max 1920px) and compress to JPEG ≤1MB for Anthropic + gallery upload. */
async function compressImageFile(file: File): Promise<{ file: File; byteSize: number }> {
  const img = await loadImageFromFile(file)
  const { width, height } = fitImageDimensions(
    img.naturalWidth,
    img.naturalHeight,
    MAX_IMAGE_DIMENSION,
  )
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')

  ctx.drawImage(img, 0, 0, width, height)

  let blob = await canvasToJpegBlob(canvas, 0.8)
  if (blob.size > MAX_IMAGE_BYTES) {
    blob = await canvasToJpegBlob(canvas, 0.6)
  }

  const baseName = file.name.replace(/\.[^.]+$/, '') || 'upload'
  const compressed = new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' })
  return { file: compressed, byteSize: blob.size }
}

function fileToBase64(file: File): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      const [, data] = result.split(',')
      resolve({
        base64: data,
        mediaType: file.type || 'image/jpeg',
      })
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function callAnthropic(params: {
  system: string
  userText: string
  imageBase64?: string
  mediaType?: string
}): Promise<string> {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const content: Array<{ type: string; text?: string; source?: object }> = []
  if (params.imageBase64 && params.mediaType) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: params.mediaType,
        data: params.imageBase64,
      },
    })
  }
  content.push({ type: 'text', text: params.userText })

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1500,
      system: params.system,
      messages: [{ role: 'user', content }],
    }),
  })

  if (!res.ok) {
    const errBody = await res.text()
    throw new Error(`Anthropic API ${res.status}: ${errBody.slice(0, 200)}`)
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new Error('Empty response from Anthropic')
  return text
}

function buildFallbackTemplates(
  location: string,
  tripKey: TripKey,
  season: NzSeason,
  seats: number,
  nextDate: string,
): GeneratedTemplates {
  const trip = TRIPS[tripKey]
  const region = regionForTrip(tripKey)
  const year = nextDate ? new Date(nextDate).getFullYear() : new Date().getFullYear()
  const hook = `แสงในภาพนี้บอกทุกอย่าง — ${location}`

  const templateA = buildGalleryShareCaption(
    { en: location, th: hook, dest: 'NZ', loc: `${location} · ${region}` },
    region.split(',')[0]?.trim() ?? region,
    { ...DEFAULT_TRIP_SHARE, season: season || 'Photo', year, durationDays: 4 },
  )

  const dayBlock = tripDayHighlightsBlock(trip, season)

  const templateB = buildSaenTemplateB({
    hook,
    tripName: trip.name,
    duration: trip.duration,
    dayBlock,
    maxPax: trip.maxPax,
    priceLine: tripPriceForPrompt(trip),
  })

  const regionShort = region.includes(',') ? region.split(',')[0]!.trim() : region
  const templateC = [
    `${location} 📍 ${countryFlagEmoji(tripKey)} ${regionShort}`,
    hook,
    `${trip.name} — เหลือ ${seats} ที่นั่ง 👉 trip2talk.com.au`,
  ].join('\n')

  return applyTemplateBHashtags({ templateA, templateB, templateC }, tripKey)
}

// ─── Main generator ───────────────────────────────────────────────────────────

function ContentGeneratorInner({ onSignOut, embedded }: { onSignOut: () => void; embedded?: boolean }) {
  const [tripKey, setTripKey] = useState<TripKey>('melbourne')
  const [nzSeason, setNzSeason] = useState<NzSeason>('Autumn')
  const [location, setLocation] = useState('Milford Sound')
  const [nextTripDate, setNextTripDate] = useState('')
  const [seats, setSeats] = useState(3)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [compressedSize, setCompressedSize] = useState<number | null>(null)
  const [compressing, setCompressing] = useState(false)
  const [lang, setLang] = useState<Lang>('TH')
  const [templatesTh, setTemplatesTh] = useState<GeneratedTemplates | null>(null)
  const [templatesEn, setTemplatesEn] = useState<GeneratedTemplates | null>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<Toast | null>(null)

  const trip = TRIPS[tripKey]
  const showSeason = tripKey === 'nz'

  const displayTemplates = useMemo(() => {
    if (lang === 'EN' && templatesEn) return templatesEn
    return templatesTh
  }, [lang, templatesTh, templatesEn])

  const showToast = useCallback((type: Toast['type'], message: string) => {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3200)
  }, [])

  const onImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      showToast('err', 'Use JPG or PNG')
      return
    }

    setCompressing(true)
    setCompressedSize(null)
    setImageFile(null)
    setImagePreview((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })

    void compressImageFile(file)
      .then(({ file: compressed, byteSize }) => {
        setImageFile(compressed)
        setImagePreview(URL.createObjectURL(compressed))
        setCompressedSize(byteSize)
      })
      .catch(() => {
        showToast('err', 'Could not compress image')
      })
      .finally(() => setCompressing(false))
  }

  const generateContent = async () => {
    if (!imageFile) {
      showToast('err', 'Upload a photo first')
      return
    }
    setGenerating(true)
    setTemplatesEn(null)
    try {
      const { base64, mediaType } = await fileToBase64(imageFile)
      let th: GeneratedTemplates

      const promptInput = {
        location,
        trip,
        tripKey,
        season: nzSeason,
        nextTripDate,
        seats,
      }

      if (import.meta.env.VITE_ANTHROPIC_API_KEY) {
        const raw = await callAnthropic({
          system: SYSTEM_PROMPT_TH,
          userText: buildAnthropicUserPrompt(promptInput, 'TH'),
          imageBase64: base64,
          mediaType,
        })
        th = applyTemplateBHashtags(parseTemplatesJson(raw), tripKey)

        const enRaw = await callAnthropic({
          system: SYSTEM_PROMPT_EN,
          userText: buildAnthropicUserPrompt(promptInput, 'EN'),
          imageBase64: base64,
          mediaType,
        })
        setTemplatesEn(applyTemplateBHashtags(parseTemplatesJson(enRaw), tripKey))
      } else {
        th = buildFallbackTemplates(location, tripKey, nzSeason, seats, nextTripDate)
        showToast('ok', 'Local templates (set VITE_ANTHROPIC_API_KEY for AI)')
      }

      setTemplatesTh(th)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Generation failed'
      showToast('err', msg)
      const fallback = buildFallbackTemplates(location, tripKey, nzSeason, seats, nextTripDate)
      setTemplatesTh(fallback)
    } finally {
      setGenerating(false)
    }
  }

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('ok', 'Copied to clipboard')
    } catch {
      showToast('err', 'Copy failed')
    }
  }

  const saveToGallery = async () => {
    if (!templatesTh || !imageFile) {
      showToast('err', 'Generate content and upload image first')
      return
    }
    setSaving(true)
    try {
      const ext = imageFile.name.split('.').pop() ?? 'jpg'
      const path = `posts/${Date.now()}-${location.replace(/\s+/g, '-').slice(0, 40)}.${ext}`
      const { error: upErr } = await supabase.storage.from('gallery').upload(path, imageFile, {
        cacheControl: '3600',
        upsert: false,
      })
      if (upErr) throw upErr

      const { data: pub } = supabase.storage.from('gallery').getPublicUrl(path)
      const { error: insErr } = await supabase.from('gallery_posts').insert({
        image_url: pub.publicUrl,
        location,
        trip_type: tripKey,
        season: showSeason ? nzSeason : null,
        template_a: templatesTh.templateA,
        template_b: templatesTh.templateB,
        template_c: templatesTh.templateC,
        template_a_en: templatesEn?.templateA ?? null,
        template_b_en: templatesEn?.templateB ?? null,
        next_trip_date: nextTripDate || null,
        seats_remaining: seats,
      })
      if (insErr) throw insErr
      showToast('ok', 'Saved to gallery_posts')
    } catch (e) {
      showToast('err', e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const signOut = () => {
    clearAdminSession()
    onSignOut()
  }

  const cards: { key: keyof GeneratedTemplates; title: string }[] = [
    { key: 'templateA', title: 'Template A — Photo caption' },
    { key: 'templateB', title: 'Template B — Full social post' },
    { key: 'templateC', title: 'Template C — Short / seats' },
  ]

  return (
    <div className={embedded ? '' : 'cg-root min-h-screen'}>
      {!embedded && (
        <header className="cg-header border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-start gap-3 min-w-0">
            <Trip2TalkLogo size="nav" className="mt-0.5" />
            <div className="min-w-0">
            <p className="cg-label text-[10px] tracking-[0.2em] uppercase">Trip2Talk Admin</p>
            <h1 className="text-lg font-bold text-white font-display">Content Generator</h1>
            <p className="text-[11px] mt-0.5 max-w-md leading-snug cg-muted">
              พี่แสน · ช่างภาพไทยในซิดนีย์ · ขับรถ จองที่พัก ถ่ายรูปให้ — ไม่ใช่ทัวร์
            </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border overflow-hidden text-[10px] font-bold">
              {(['TH', 'EN'] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`px-3 py-1.5 ${lang === l ? 'cg-tab-active' : 'text-neutral-500'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button type="button" onClick={signOut} className="cg-btn-ghost text-xs px-3 py-1.5 rounded-lg">
              Sign out
            </button>
          </div>
        </header>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <p className="text-[11px] cg-muted max-w-md leading-snug">
            พี่แสน · ช่างภาพไทยในซิดนีย์ · ขับรถ จองที่พัก ถ่ายรูปให้ — ไม่ใช่ทัวร์
          </p>
          <div className="flex rounded-lg border overflow-hidden text-[10px] font-bold">
            {(['TH', 'EN'] as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLang(l)}
                className={`px-3 py-1.5 ${lang === l ? 'cg-tab-active' : 'text-neutral-500'}`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="cg-layout grid gap-6 lg:grid-cols-2">
        {/* Left — inputs */}
        <section className="cg-panel rounded-xl p-4 border space-y-4">
          <h2 className="cg-label text-xs uppercase tracking-wider">Inputs</h2>

          <label className="block text-xs">
            <span className="text-neutral-400">Trip</span>
            <select
              value={tripKey}
              onChange={(e) => setTripKey(e.target.value as TripKey)}
              className="cg-input mt-1 w-full px-3 py-2 rounded-lg text-sm"
            >
              {(Object.keys(TRIPS) as TripKey[]).map((key) => (
                <option key={key} value={key}>
                  {TRIPS[key].name}
                </option>
              ))}
            </select>
          </label>

          {showSeason && (
            <label className="block text-xs">
              <span className="text-neutral-400">Season (NZ)</span>
              <select
                value={nzSeason}
                onChange={(e) => setNzSeason(e.target.value as NzSeason)}
                className="cg-input mt-1 w-full px-3 py-2 rounded-lg text-sm"
              >
                {(TRIPS.nz as TripNz).seasons.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block text-xs">
            <span className="text-neutral-400">Location name</span>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="cg-input mt-1 w-full px-3 py-2 rounded-lg text-sm"
              placeholder="Milford Sound"
            />
          </label>

          <label className="block text-xs">
            <span className="text-neutral-400">Next trip date</span>
            <input
              type="date"
              value={nextTripDate}
              onChange={(e) => setNextTripDate(e.target.value)}
              className="cg-input mt-1 w-full px-3 py-2 rounded-lg text-sm"
            />
          </label>

          <label className="block text-xs">
            <span className="text-neutral-400">Seats remaining (1–5)</span>
            <input
              type="number"
              min={1}
              max={5}
              value={seats}
              onChange={(e) => setSeats(Math.min(5, Math.max(1, Number(e.target.value) || 1)))}
              className="cg-input mt-1 w-full px-3 py-2 rounded-lg text-sm font-mono"
            />
          </label>

          <label className="block text-xs">
            <span className="text-neutral-400">Image (JPG / PNG)</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onImageChange}
              className="mt-1 w-full text-xs text-neutral-400"
            />
          </label>
          {compressing && (
            <p className="text-xs text-neutral-500 font-mono">Compressing image…</p>
          )}
          {imagePreview && (
            <>
              <img
                src={imagePreview}
                alt="Preview"
                className="w-full max-h-48 object-cover rounded-lg border border-neutral-800"
              />
              {compressedSize != null && (
                <p className="text-xs text-[#C9A84C] font-mono mt-1">
                  Compressed size: {formatFileSize(compressedSize)}
                  {compressedSize > MAX_IMAGE_BYTES ? ' (over 1 MB — may be slow for API)' : ''}
                </p>
              )}
            </>
          )}

          <button
            type="button"
            disabled={generating || saving || compressing || !imageFile}
            onClick={() => void generateContent()}
            className="cg-btn w-full py-3 rounded-lg font-bold text-sm disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {generating && <span className="cg-spinner" aria-hidden />}
            {generating ? 'Generating…' : '✨ Generate Content'}
          </button>
          {generating && (
            <p className="text-center text-xs text-[#C9A84C]/80 font-mono">Claude · TH + EN…</p>
          )}
        </section>

        {/* Right — outputs */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="cg-label text-xs uppercase tracking-wider">Outputs</h2>
            <button
              type="button"
              disabled={saving || !templatesTh}
              onClick={() => void saveToGallery()}
              className="cg-btn px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-40"
            >
              {saving ? 'Saving…' : '💾 Save to Gallery'}
            </button>
          </div>

          {!displayTemplates && (
            <div className="cg-panel rounded-xl p-8 border border-dashed border-neutral-700 text-center text-neutral-500 text-sm">
              Upload a photo and click Generate Content
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {displayTemplates &&
              cards.map(({ key, title }) => (
                <article key={key} className="cg-panel rounded-xl p-4 border flex flex-col">
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="text-sm font-semibold text-white">{title}</h3>
                    <button
                      type="button"
                      onClick={() => void copyText(displayTemplates[key])}
                      className="cg-btn-ghost text-[10px] px-2 py-1 rounded shrink-0"
                    >
                      Copy
                    </button>
                  </div>
                  <pre className="flex-1 text-[11px] text-neutral-300 whitespace-pre-wrap font-sans leading-relaxed bg-black/40 rounded-lg p-3 border border-neutral-800/80 max-h-64 overflow-y-auto">
                    {displayTemplates[key]}
                  </pre>
                </article>
              ))}
          </div>
        </section>
      </div>

      {toast && (
        <div
          className={`cg-toast fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm font-medium shadow-lg z-50 ${
            toast.type === 'ok' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      <style>{`
        .cg-root { background: #0a0a0a; color: #f5f0e8; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
        .font-display { font-family: 'Playfair Display', Georgia, serif; }
        .cg-label { color: #c9a84c; }
        .cg-muted { color: #8a8070; }
        .cg-panel { background: #141414; border-color: #2a2520 !important; }
        .cg-input { background: #1c1c1c; border: 1px solid #2a2520; color: #f5f0e8; }
        .cg-input:focus { outline: none; border-color: #c9a84c; box-shadow: 0 0 0 2px rgba(201, 168, 76, 0.2); }
        .cg-btn { background: linear-gradient(135deg, #c9a84c, #e8c96a); border: 1px solid #c9a84c; color: #0a0a0a; font-weight: 700; }
        .cg-btn:hover:not(:disabled) { box-shadow: 0 4px 20px rgba(201, 168, 76, 0.25); }
        .cg-btn:disabled { cursor: not-allowed; }
        .cg-btn-ghost { border: 1px solid #2a2520; color: #8a8070; }
        .cg-header { background: rgba(10,10,10,0.98); border-color: #2a2520 !important; }
        .cg-tab-active { background: rgba(201,168,76,0.15); color: #e8c96a; }
        .cg-spinner {
          width: 1rem; height: 1rem;
          border: 2px solid rgba(201,168,76,0.25);
          border-top-color: #c9a84c;
          border-radius: 50%;
          animation: cg-spin 0.7s linear infinite;
        }
        @keyframes cg-spin { to { transform: rotate(360deg); } }
        @media (max-width: 1023px) {
          .cg-layout { grid-template-columns: 1fr !important; }
        }
        @media (min-width: 1024px) {
          .cg-layout { grid-template-columns: 1fr 1.1fr; }
        }
      `}</style>
    </div>
  )
}

type AdminTab = 'content' | 'bookings'

function AdminShell({
  onSignOut,
  children,
  tab,
  onTab,
}: {
  onSignOut: () => void
  children: ReactNode
  tab: AdminTab
  onTab: (t: AdminTab) => void
}) {
  return (
    <div className="cg-root min-h-screen">
      <header className="cg-header border-b px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="cg-label text-[10px] tracking-[0.2em] uppercase">Trip2Talk Admin</p>
          <h1 className="text-lg font-bold text-white font-display">Admin</h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border overflow-hidden text-[10px] font-bold">
            <button
              type="button"
              onClick={() => onTab('content')}
              className={`px-3 py-1.5 ${tab === 'content' ? 'cg-tab-active' : 'text-neutral-500'}`}
            >
              ✨ Content
            </button>
            <button
              type="button"
              onClick={() => onTab('bookings')}
              className={`px-3 py-1.5 ${tab === 'bookings' ? 'cg-tab-active' : 'text-neutral-500'}`}
            >
              📋 จอง
            </button>
          </div>
          <button type="button" onClick={onSignOut} className="cg-btn-ghost text-xs px-3 py-1.5 rounded-lg">
            Sign out
          </button>
        </div>
      </header>
      <div className="max-w-7xl mx-auto p-4">{children}</div>
    </div>
  )
}

export default function ContentGeneratorPage() {
  const [authed, setAuthed] = useState(() => isAdminSessionValid())
  const [tab, setTab] = useState<AdminTab>('content')

  const handleUnlock = () => {
    setAdminSession()
    setAuthed(true)
  }

  const handleSignOut = () => {
    clearAdminSession()
    setAuthed(false)
  }

  if (!authed) {
    return <PinLogin onUnlock={handleUnlock} />
  }

  return (
    <AdminShell tab={tab} onTab={setTab} onSignOut={handleSignOut}>
      {tab === 'content' ? <ContentGeneratorInner onSignOut={handleSignOut} embedded /> : <AdminBookings />}
    </AdminShell>
  )
}
