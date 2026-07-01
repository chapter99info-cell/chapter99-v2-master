export type AppProduct = 'chapter99'

/** V2 — Thai Massage platform only (no Trip2Talk routing). */
export function getAppProduct(_hostname?: string): AppProduct {
  return 'chapter99'
}

export function isTrip2TalkProduct(_hostname?: string): boolean {
  return false
}

export function isChapter99Product(_hostname?: string): boolean {
  return true
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
