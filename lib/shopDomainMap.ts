/** Hostname → shop slug map (edge-safe, no import.meta). */

import { getBaseShopDomainMap } from './shopsConfig'

export function normalizeHostname(host: string): string {
  return host.trim().toLowerCase().replace(/^www\./, '')
}

export function normalizeCustomDomain(input: string): string {
  const trimmed = input.trim().toLowerCase()
  if (!trimmed) return ''
  return trimmed
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export function parseShopDomainMapJson(raw: string | undefined): Record<string, string> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [domain, slug] of Object.entries(parsed)) {
      const host = normalizeCustomDomain(domain)
      const key = typeof slug === 'string' ? slug.trim().toLowerCase() : ''
      if (host && key) out[host] = key
    }
    return out
  } catch {
    return {}
  }
}

export function isPlatformHost(host: string): boolean {
  const h = normalizeHostname(host)
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true
  if (h.endsWith('.vercel.app')) return true
  return false
}

/** Base map from shops.config.json with optional env JSON overrides on top */
export function buildShopDomainMap(envMapJson?: string): Record<string, string> {
  const base = getBaseShopDomainMap()
  const envOverride = parseShopDomainMapJson(envMapJson)
  return { ...base, ...envOverride }
}

export type ShopDomainResolveSource = 'config' | 'env-override' | 'platform' | 'none'

export interface ShopDomainResolveResult {
  host: string
  slug: string | null
  source: ShopDomainResolveSource
  /** True when a custom domain has no mapping — caller should alert */
  needsAlert: boolean
}

export function resolveShopFromHostname(
  host: string,
  envMapJson?: string
): ShopDomainResolveResult {
  const h = normalizeHostname(host)
  if (!h || isPlatformHost(h)) {
    return { host: h ?? '', slug: null, source: 'platform', needsAlert: false }
  }

  const baseMap = getBaseShopDomainMap()
  const envMap = parseShopDomainMapJson(envMapJson)
  const slug = envMap[h] ?? baseMap[h] ?? null

  if (slug) {
    return {
      host: h,
      slug,
      source: envMap[h] ? 'env-override' : 'config',
      needsAlert: false,
    }
  }

  return { host: h, slug: null, source: 'none', needsAlert: true }
}

/** @deprecated alias — prefer resolveShopFromHostname for alert metadata */
export function resolveSlugFromHostname(host: string, envMapJson?: string): string | null {
  return resolveShopFromHostname(host, envMapJson).slug
}
