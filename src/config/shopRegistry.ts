/**
 * Canonical multi-shop registry — single source of truth for domain → shop routing.
 * `shops.config.json` is generated from this file on prebuild (see scripts/validate-shops.ts).
 *
 * Do not edit Mira / Princess entries without verifying domain conflicts:
 *   npm run validate-shops
 */

export type ShopTier = 'starter' | 'professional' | 'business'

export interface ShopRegistryEntry {
  name: string
  shopId: string
  shopSlug: string
  domains: string[]
  tier?: ShopTier
  active?: boolean
}

export interface ShopsConfigFile {
  shops: Record<string, ShopRegistryEntry>
}

export type ShopDomainResolveSource = 'registry' | 'env-override' | 'platform' | 'none'

export interface ShopDomainResolveResult {
  host: string
  slug: string | null
  shopId: string | null
  source: ShopDomainResolveSource
  /** True when a custom domain has no mapping — caller should alert */
  needsAlert: boolean
}

/** Committed shops — preserve existing Mira config; add new shops via Onboarding Wizard only */
export const SHOP_REGISTRY: Record<string, ShopRegistryEntry> = {
  mira: {
    name: 'Mira Thai Massage',
    shopId: 'shop-001',
    shopSlug: 'mira',
    domains: [
      'chapter99info.tech',
      'www.chapter99info.tech',
      'mirathaimassage.com.au',
      'www.mirathaimassage.com.au',
      'chapter99thaimass-v20.vercel.app',
    ],
    tier: 'professional',
    active: true,
  },
}

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

/**
 * Shared staff / Super Admin hostnames (not a public shop site).
 * www. is stripped by normalizeHostname before compare.
 */
export const STAFF_PLATFORM_HOSTS = ['chapter99solutions.com.au'] as const

export function isStaffPlatformHost(host: string): boolean {
  const h = normalizeHostname(host)
  return (STAFF_PLATFORM_HOSTS as readonly string[]).includes(h)
}

export function isPlatformHost(host: string): boolean {
  const h = normalizeHostname(host)
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true
  if (h.endsWith('.vercel.app')) return true
  if (isStaffPlatformHost(h)) return true
  return false
}

export function getShopsConfigFromRegistry(
  registry: Record<string, ShopRegistryEntry> = SHOP_REGISTRY
): ShopsConfigFile {
  return { shops: registry }
}

/** Flat hostname → shopSlug map from registry (www. stripped on lookup keys) */
export function buildRegistryDomainMap(
  registry: Record<string, ShopRegistryEntry> = SHOP_REGISTRY
): Record<string, string> {
  const map: Record<string, string> = {}
  for (const entry of Object.values(registry)) {
    const slug = entry.shopSlug?.trim().toLowerCase()
    if (!slug) continue
    for (const domain of entry.domains ?? []) {
      const host = normalizeCustomDomain(domain)
      if (host) map[host] = slug
    }
  }
  return map
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

export function buildShopDomainMap(envMapJson?: string): Record<string, string> {
  const base = buildRegistryDomainMap()
  const envOverride = parseShopDomainMapJson(envMapJson)
  return { ...base, ...envOverride }
}

export function getShopBySlug(slug: string): ShopRegistryEntry | null {
  const key = slug.trim().toLowerCase()
  for (const entry of Object.values(SHOP_REGISTRY)) {
    if (entry.shopSlug?.trim().toLowerCase() === key) return entry
  }
  return null
}

export function getShopById(shopId: string): ShopRegistryEntry | null {
  const key = shopId.trim()
  for (const entry of Object.values(SHOP_REGISTRY)) {
    if (entry.shopId === key) return entry
  }
  return null
}

export function resolveShopFromHostname(
  host: string,
  envMapJson?: string
): ShopDomainResolveResult {
  const h = normalizeHostname(host)
  if (!h) {
    return { host: '', slug: null, shopId: null, source: 'platform', needsAlert: false }
  }

  const baseMap = buildRegistryDomainMap()
  const envMap = parseShopDomainMapJson(envMapJson)
  const map = { ...baseMap, ...envMap }

  const slug =
    envMap[h] ??
    baseMap[h] ??
    (h === 'chapter99thaimass-v20.vercel.app' ? (map[h] ?? 'mira') : null)

  if (slug) {
    const shop = getShopBySlug(slug)
    return {
      host: h,
      slug,
      shopId: shop?.shopId ?? null,
      source: envMap[h] ? 'env-override' : 'registry',
      needsAlert: false,
    }
  }

  if (isPlatformHost(h)) {
    return { host: h, slug: null, shopId: null, source: 'platform', needsAlert: false }
  }

  return { host: h, slug: null, shopId: null, source: 'none', needsAlert: true }
}

export interface ShopRegistryValidationIssue {
  code: string
  message: string
}

/** Validate registry structure — no duplicate domains, slugs, or shopIds */
export function validateShopRegistry(
  registry: Record<string, ShopRegistryEntry> = SHOP_REGISTRY
): ShopRegistryValidationIssue[] {
  const issues: ShopRegistryValidationIssue[] = []
  const slugSeen = new Map<string, string>()
  const idSeen = new Map<string, string>()
  const domainSeen = new Map<string, string>()

  for (const [key, entry] of Object.entries(registry)) {
    const shopId = entry.shopId?.trim()
    const shopSlug = entry.shopSlug?.trim().toLowerCase()
    const name = entry.name ?? key

    if (!shopId) {
      issues.push({ code: 'missing-shop-id', message: `Shop "${key}" is missing shopId` })
    }
    if (!shopSlug) {
      issues.push({ code: 'missing-shop-slug', message: `Shop "${key}" is missing shopSlug` })
    }

    if (shopSlug) {
      const prevSlug = slugSeen.get(shopSlug)
      if (prevSlug) {
        issues.push({
          code: 'duplicate-shop-slug',
          message: `Duplicate shopSlug "${shopSlug}" (${prevSlug} and ${key})`,
        })
      } else {
        slugSeen.set(shopSlug, key)
      }
    }

    if (shopId) {
      const prevId = idSeen.get(shopId)
      if (prevId) {
        issues.push({
          code: 'duplicate-shop-id',
          message: `Duplicate shopId "${shopId}" (${prevId} and ${key})`,
        })
      } else {
        idSeen.set(shopId, key)
      }
    }

    for (const domain of entry.domains ?? []) {
      const host = normalizeCustomDomain(domain)
      if (!host) continue
      const prev = domainSeen.get(host)
      if (prev && prev !== shopSlug) {
        issues.push({
          code: 'duplicate-domain',
          message: `Domain "${host}" is listed for multiple shops (${prev} and ${shopSlug})`,
        })
      } else if (shopSlug) {
        domainSeen.set(host, shopSlug)
      }
    }

    if (!entry.domains?.length) {
      issues.push({
        code: 'missing-domains',
        message: `Shop "${name}" (${key}) has no domains configured`,
      })
    }
  }

  if (Object.keys(registry).length === 0) {
    issues.push({ code: 'empty-registry', message: 'SHOP_REGISTRY is empty' })
  }

  return issues
}

/** Ensure env SHOP_DOMAIN_MAP does not remap a registry domain to a different slug */
export function validateEnvDomainMap(
  envMapJson: string | undefined,
  registry: Record<string, ShopRegistryEntry> = SHOP_REGISTRY
): ShopRegistryValidationIssue[] {
  const issues: ShopRegistryValidationIssue[] = []
  const baseMap = buildRegistryDomainMap(registry)
  const envMap = parseShopDomainMapJson(envMapJson)

  for (const [host, envSlug] of Object.entries(envMap)) {
    const registrySlug = baseMap[host]
    if (registrySlug && registrySlug !== envSlug) {
      issues.push({
        code: 'env-domain-conflict',
        message: `SHOP_DOMAIN_MAP maps "${host}" to "${envSlug}" but registry maps it to "${registrySlug}"`,
      })
    }
  }

  return issues
}
