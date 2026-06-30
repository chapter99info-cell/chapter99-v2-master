import {
  buildShopDomainMap,
  isPlatformHost,
  normalizeCustomDomain,
  normalizeHostname,
  parseShopDomainMapJson,
  resolveShopFromHostname,
} from '../../lib/shopDomainMap'

export {
  buildShopDomainMap,
  isPlatformHost,
  normalizeCustomDomain,
  normalizeHostname,
  parseShopDomainMapJson,
  resolveShopFromHostname,
}

const CLIENT_MAP_JSON =
  (import.meta.env.VITE_SHOP_DOMAIN_MAP as string | undefined) ??
  (import.meta.env.SHOP_DOMAIN_MAP as string | undefined)

export function getClientShopDomainMap(): Record<string, string> {
  return buildShopDomainMap(CLIENT_MAP_JSON)
}

export function resolveSlugFromCurrentHost(): string | null {
  if (typeof window === 'undefined') return null
  return resolveShopFromHostname(window.location.hostname, CLIENT_MAP_JSON).slug
}

export function resolveShopFromCurrentHost() {
  if (typeof window === 'undefined') {
    return { host: '', slug: null, source: 'platform' as const, needsAlert: false }
  }
  return resolveShopFromHostname(window.location.hostname, CLIENT_MAP_JSON)
}

export function isOnCustomShopDomain(): boolean {
  if (typeof window === 'undefined') return false
  return Boolean(resolveSlugFromCurrentHost())
}

/** Effective ?shop= slug: query param, then custom-domain map, then null. */
export function resolveEffectiveShopSlug(urlSlug: string | null): string | null {
  return urlSlug?.trim().toLowerCase() || resolveSlugFromCurrentHost() || null
}

export function buildOriginForCustomDomain(domain: string | undefined): string | null {
  const host = normalizeCustomDomain(domain ?? '')
  if (!host) return null
  return `https://${host}`
}
