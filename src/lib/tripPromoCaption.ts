import type { Tour } from '../types/tour'

export interface TripPromoCaptionInput {
  emotionalHook: string
  location: string
  tripName: string
  durationDays: number
  nights: number
  destinationsList: string
  priceAud: number
  keyInclusions: string
  bookingUrl?: string
}

const DEFAULT_KEY_INCLUSIONS = 'ที่พัก · รถทัวร์ · ไกด์ถ่ายรูป'
const DEFAULT_BOOKING_URL = 'https://trip2talk.com.au'

const DEFAULT_HOOK_BY_DESTINATION: Record<string, string> = {
  'New Zealand': 'แสงเหนือไม่รอใคร — แต่ทริปนี้รอคุณอยู่',
  Sydney: 'ซิดนีย์ยามค่ำ — แสงที่ถ่ายแล้วติดใจไม่ลืม',
}

/** Inclusive calendar days between tour start and end (YYYY-MM-DD). */
export function tripDaysNights(startDate: string, endDate: string): { days: number; nights: number } {
  const start = new Date(`${startDate}T12:00:00`)
  const end = new Date(`${endDate}T12:00:00`)
  const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1)
  return { days, nights: Math.max(0, days - 1) }
}

export function formatPromoPriceAud(amount: number): string {
  return amount.toLocaleString('en-AU', { maximumFractionDigits: 0 })
}

/**
 * FB/IG trip promo post:
 * "[HOOK]" 📍
 * [LOCATION] ไม่ได้แค่สวย — ...
 * 🗓 trip | N วัน M คืน
 * ...
 */
export function buildTripPromoCaption(p: TripPromoCaptionInput): string {
  const url = p.bookingUrl ?? DEFAULT_BOOKING_URL
  const price = formatPromoPriceAud(p.priceAud)
  return [
    `"${p.emotionalHook.trim()}" 📍`,
    '',
    `${p.location.trim()} ไม่ได้แค่สวย — มันคือช็อตที่คุณฝันอยากถ่ายมาตลอด`,
    '',
    `🗓 ${p.tripName} | ${p.durationDays} วัน ${p.nights} คืน`,
    `📍 ${p.destinationsList}`,
    `💰 เริ่มต้น $${price}/คน (รวม ${p.keyInclusions})`,
    '',
    'สิ่งที่คุณจะได้กลับบ้าน:',
    '✅ ภาพที่ถ่ายเองจริงๆ ไม่ใช่แค่ selfie',
    '✅ เทคนิคจาก Saen — Travel Photographer ตัวจริง',
    '✅ ความทรงจำที่ไม่มีขายในทัวร์ทั่วไป',
    '',
    `🔗 ดูรายละเอียด + จองได้ที่ ${url.replace(/^https?:\/\//, '')}`,
    '💬 หรือทักมาคุยก่อนได้เลย ไม่มีค่าใช้จ่าย',
  ].join('\n')
}

export interface TripPromoFromTourOptions {
  emotionalHook?: string
  location?: string
  tripName?: string
  destinationsList?: string
  keyInclusions?: string
  bookingUrl?: string
}

export function buildTripPromoFromTour(
  tour: Pick<Tour, 'trip_code' | 'destination' | 'start_date' | 'end_date' | 'price_aud'>,
  opts: TripPromoFromTourOptions = {},
): string {
  const { days, nights } = tripDaysNights(tour.start_date, tour.end_date)
  return buildTripPromoCaption({
    emotionalHook:
      opts.emotionalHook ??
      DEFAULT_HOOK_BY_DESTINATION[tour.destination] ??
      'ทริปนี้ไม่ได้แค่เที่ยว — คุณจะกลับบ้านพร้อมภาพที่ภูมิใจ',
    location: opts.location ?? tour.destination,
    tripName: opts.tripName ?? `${tour.destination} · ${tour.trip_code}`,
    durationDays: days,
    nights,
    destinationsList: opts.destinationsList ?? tour.destination,
    priceAud: tour.price_aud,
    keyInclusions: opts.keyInclusions ?? DEFAULT_KEY_INCLUSIONS,
    bookingUrl: opts.bookingUrl,
  })
}

/** Photo-route trip promo (Sydney → Melbourne style) */

export interface PhotoTripPromoCaptionInput {
  location: string
  regionLabel: string
  hook: string
  route: string
  durationDays: number
  nights: number
  description: string
  dayHighlights: string
  maxPaxLabel?: string
  priceStandardAud: number
  priceProAud: number
  inclusions?: string[]
  bookingUrl?: string
}

const DEFAULT_PHOTO_INCLUSIONS = [
  'ที่พัก + อาหารตามโปรแกรม',
  'ไกด์ส่วนตัวตลอดทริป',
  'Workshop เทคนิคถ่ายภาพ On-location',
  'Itinerary ที่ออกแบบมาเพื่อ "แสง" โดยเฉพาะ',
]

/** Sydney → Melbourne · 4D3N reference preset */
export const SYD_MEL_PHOTO_TRIP_PRESET: Omit<
  PhotoTripPromoCaptionInput,
  'hook' | 'location' | 'description'
> = {
  regionLabel: 'Victoria, Australia',
  route: 'Sydney → Melbourne',
  durationDays: 4,
  nights: 3,
  dayHighlights:
    'Day 1 · Sydney Opera House & Harbour sunset\n' +
    'Day 2 · Blue Mountains golden hour\n' +
    'Day 3 · Great Ocean Road · Twelve Apostles\n' +
    'Day 4 · Melbourne laneways & night street',
  maxPaxLabel: '4-5',
  priceStandardAud: 1302,
  priceProAud: 2102,
}

const DEFAULT_PHOTO_DESCRIPTION =
  'ทริปนี้ออกแบบมาเพื่อคนที่อยากได้ภาพสวยจริงๆ — ไม่ใช่แค่เช็คอิน ' +
  'ทุกจุดแวะตามช่วงแสงที่ Saen ใช้ถ่ายงานจริง ' +
  'กลับบ้านพร้อมพอร์ตโฟลิโอที่ภูมิใจและเทคนิคที่ใช้ต่อได้ทันที'

/**
 * [LOCATION] ✦ [REGION]
 * [HOOK]
 * 📸 Trip2Talk · [ROUTE] · N วัน M คืน "[HOOK]" 📍 [LOCATION]
 * ...
 */
export function buildPhotoTripPromoCaption(p: PhotoTripPromoCaptionInput): string {
  const hook = p.hook.trim()
  const loc = p.location.trim()
  const durShort = `${p.durationDays} วัน ${p.nights} คืน`
  const url = (p.bookingUrl ?? DEFAULT_BOOKING_URL).replace(/^https?:\/\//, '')
  const maxPax = p.maxPaxLabel ?? '4-5'
  const inclusions = p.inclusions ?? DEFAULT_PHOTO_INCLUSIONS
  const std = formatPromoPriceAud(p.priceStandardAud)
  const pro = formatPromoPriceAud(p.priceProAud)

  return [
    `${loc} ✦ ${p.regionLabel.trim()}`,
    hook,
    `📸 Trip2Talk · ${p.route} · ${durShort} "${hook}" 📍 ${loc}`,
    '',
    p.description.trim(),
    '',
    `🗓 ทริปถ่ายภาพ ${durShort} | ${p.route}`,
    `📍 ${p.dayHighlights.trim()}`,
    `👥 รับเพียง ${maxPax} คน/ทริป (Private Group)`,
    `💰 Standard $${std}/คน | Pro $${pro}/คน`,
    '',
    'รวมในราคา:',
    ...inclusions.map((item) => `✅ ${item}`),
    '',
    `🔗 ${url} | 💬 ทักมาจองได้เลย`,
  ].join('\n')
}

export interface PhotoTripPromoFromTourOptions {
  hook?: string
  location?: string
  regionLabel?: string
  route?: string
  description?: string
  dayHighlights?: string
  priceStandardAud?: number
  priceProAud?: number
  maxPaxLabel?: string
  bookingUrl?: string
}

export function buildPhotoTripPromoFromTour(
  tour: Pick<Tour, 'trip_code' | 'destination' | 'start_date' | 'end_date' | 'price_aud' | 'max_pax'>,
  opts: PhotoTripPromoFromTourOptions = {},
): string {
  const { days, nights } = tripDaysNights(tour.start_date, tour.end_date)
  const useSydMel =
    tour.destination === 'Sydney' ||
    tour.trip_code.toUpperCase().includes('SYD') ||
    tour.trip_code.toUpperCase().includes('MEL')

  const preset = useSydMel ? SYD_MEL_PHOTO_TRIP_PRESET : null
  const standard = opts.priceStandardAud ?? preset?.priceStandardAud ?? tour.price_aud
  const pro =
    opts.priceProAud ??
    preset?.priceProAud ??
    Math.round(standard * 1.612)

  return buildPhotoTripPromoCaption({
    location: opts.location ?? 'Twelve Apostles',
    regionLabel: opts.regionLabel ?? preset?.regionLabel ?? tour.destination,
    hook:
      opts.hook ??
      DEFAULT_HOOK_BY_DESTINATION[tour.destination] ??
      'แสงทองยามเย็น — ช็อตที่รอคุณมานาน',
    route: opts.route ?? preset?.route ?? tour.destination,
    durationDays: preset?.durationDays ?? days,
    nights: preset?.nights ?? nights,
    description: opts.description ?? DEFAULT_PHOTO_DESCRIPTION,
    dayHighlights:
      opts.dayHighlights ??
      preset?.dayHighlights ??
      `${tour.destination} · ${tour.trip_code}`,
    maxPaxLabel:
      opts.maxPaxLabel ??
      preset?.maxPaxLabel ??
      String(Math.min(tour.max_pax, 5)),
    priceStandardAud: standard,
    priceProAud: pro,
    bookingUrl: opts.bookingUrl,
  })
}

/** Short scarcity post — seats left + CTA */

export interface ScarcityTripPromoInput {
  location: string
  regionLabel: string
  feelingLine: string
  tripLabel: string
  seatsLeft: number
  bookingUrl?: string
}

export function tourSeatsLeft(tour: Pick<Tour, 'max_pax' | 'current_pax'>): number {
  return Math.max(0, tour.max_pax - tour.current_pax)
}

/**
 * [LOCATION] 📍 [REGION]
 * [ONE LINE FEELING]
 * [TRIP] — เหลือ [X] ที่นั่ง
 * 👉 trip2talk.com.au
 */
export function buildScarcityTripPromoCaption(p: ScarcityTripPromoInput): string {
  const url = (p.bookingUrl ?? DEFAULT_BOOKING_URL).replace(/^https?:\/\//, '')
  const seats = Math.max(0, Math.floor(p.seatsLeft))
  return [
    `${p.location.trim()} 📍 ${p.regionLabel.trim()}`,
    p.feelingLine.trim(),
    `${p.tripLabel.trim()} — เหลือ ${seats} ที่นั่ง`,
    `👉 ${url}`,
  ].join('\n')
}

export interface ScarcityTripPromoFromTourOptions {
  location?: string
  regionLabel?: string
  feelingLine?: string
  tripLabel?: string
  seatsLeft?: number
  bookingUrl?: string
}

export function buildScarcityTripPromoFromTour(
  tour: Pick<Tour, 'trip_code' | 'destination' | 'max_pax' | 'current_pax'>,
  opts: ScarcityTripPromoFromTourOptions = {},
): string {
  const melbourne =
    tour.trip_code.toUpperCase().includes('MEL') ||
    tour.destination === 'Sydney'

  return buildScarcityTripPromoCaption({
    location: opts.location ?? (melbourne ? 'Melbourne' : tour.destination),
    regionLabel: opts.regionLabel ?? (melbourne ? 'Victoria' : tour.destination),
    feelingLine:
      opts.feelingLine ??
      DEFAULT_HOOK_BY_DESTINATION[tour.destination] ??
      'ทริปถ่ายภาพ small group — จองก่อนที่เต็ม',
    tripLabel: opts.tripLabel ?? (melbourne ? 'Melbourne Trip' : `${tour.destination} Trip`),
    seatsLeft: opts.seatsLeft ?? tourSeatsLeft(tour),
    bookingUrl: opts.bookingUrl,
  })
}
