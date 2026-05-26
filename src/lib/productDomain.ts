import { normalizeHostname } from '../../lib/shopDomainMap'

export type AppProduct = 'trip2talk' | 'chapter99' | 'dev'

/** Hostnames that serve Trip2Talk V4 only */
const TRIP2TALK_HOSTS = new Set([
  'trip2talk.app',
  'trip2talk.com.au',
  'www.trip2talk.com.au',
  'trip2talk-v4.vercel.app',
])

/** Hostnames that serve Chapter99 / Mira Thai Massage public site only */
const CHAPTER99_HOSTS = new Set(['chapter99info.tech', 'www.chapter99info.tech'])

export const TRIP2TALK_ORIGIN = (
  import.meta.env.VITE_TRIP2TALK_URL ??
  import.meta.env.VITE_APP_URL ??
  import.meta.env.VITE_PUBLIC_APP_URL ??
  'https://trip2talk.com.au'
).replace(/\/$/, '')

export const CHAPTER99_ORIGIN = (
  import.meta.env.VITE_CHAPTER99_URL ?? 'https://chapter99info.tech'
).replace(/\/$/, '')

export function getAppProduct(hostname?: string): AppProduct {
  if (typeof hostname === 'undefined' && typeof window !== 'undefined') {
    hostname = window.location.hostname
  }
  const h = normalizeHostname(hostname ?? '')

  if (TRIP2TALK_HOSTS.has(h)) return 'trip2talk'
  if (CHAPTER99_HOSTS.has(h)) return 'chapter99'

  const forced = import.meta.env.VITE_APP_PRODUCT
  if (forced === 'trip2talk' || forced === 'chapter99') return forced

  return 'dev'
}

export function isTrip2TalkProduct(hostname?: string): boolean {
  return getAppProduct(hostname) === 'trip2talk'
}

export function isChapter99Product(hostname?: string): boolean {
  return getAppProduct(hostname) === 'chapter99'
}

/** Trip2Talk URL paths that must not render on the spa domain */
export const TRIP2TALK_PATH_PREFIXES = [
  '/onboard',
  '/app',
  '/staff',
  '/cashier',
  '/owner',
] as const

/** Spa / Chapter99 paths that must not render on trip2talk.app */
export const CHAPTER99_PUBLIC_PATHS = [
  '/book',
  '/cancel',
  '/privacy',
  '/terms',
  '/voucher',
  '/about',
  '/services',
  '/menu',
  '/chapter99',
  '/spa',
] as const

export function buildExternalUrl(origin: string, pathname: string, search = '', hash = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${origin}${path}${search}${hash}`
}
