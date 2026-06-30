/**
 * Committed shop domain map — primary source of truth.
 * Vercel SHOP_DOMAIN_MAP / VITE_SHOP_DOMAIN_MAP override these entries only.
 */
import shopsConfigJson from '../shops.config.json'

export interface ShopConfigEntry {
  name?: string
  shopId: string
  shopSlug: string
  domains: string[]
}

export interface ShopsConfigFile {
  shops: Record<string, ShopConfigEntry>
}

function normalizeDomainKey(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

export function getShopsConfigFile(): ShopsConfigFile {
  return shopsConfigJson as ShopsConfigFile
}

/** Flat hostname → shopSlug map from shops.config.json */
export function getBaseShopDomainMap(config: ShopsConfigFile = getShopsConfigFile()): Record<string, string> {
  const map: Record<string, string> = {}
  for (const entry of Object.values(config.shops ?? {})) {
    const slug = entry.shopSlug?.trim().toLowerCase()
    if (!slug) continue
    for (const domain of entry.domains ?? []) {
      const host = normalizeDomainKey(domain)
      if (host) map[host] = slug
    }
  }
  return map
}

/** All configured hostnames (normalized), for build-time Vercel domain checks */
export function getConfiguredShopHostnames(config: ShopsConfigFile = getShopsConfigFile()): Set<string> {
  return new Set(Object.keys(getBaseShopDomainMap(config)))
}
