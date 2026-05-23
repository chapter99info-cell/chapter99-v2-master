import { buildOriginForCustomDomain, isOnCustomShopDomain, resolveSlugFromCurrentHost } from './shopDomain'

const DEFAULT_PUBLIC_ORIGIN = 'https://chapter99-v4-complete.vercel.app'

/** Base URL for public menu / QR links (production or current origin in dev). */
export function getPublicAppOrigin(customDomain?: string): string {
  const fromDomain = buildOriginForCustomDomain(customDomain)
  if (fromDomain) return fromDomain
  const env = import.meta.env.VITE_PUBLIC_APP_URL?.trim()
  if (env && env.startsWith('http')) return env.replace(/\/$/, '')
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return DEFAULT_PUBLIC_ORIGIN
}

export function buildPublicMenuUrl(slug: string, customDomain?: string): string {
  const key = slug.trim().toLowerCase()
  const origin = getPublicAppOrigin(customDomain)
  if (customDomain || isOnCustomShopDomain() || resolveSlugFromCurrentHost() === key) {
    return `${origin}/menu`
  }
  return `${origin}/menu?shop=${encodeURIComponent(key)}`
}
