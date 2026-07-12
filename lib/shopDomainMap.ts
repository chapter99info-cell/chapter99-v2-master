/** Hostname → shop slug map (edge-safe). Registry: src/config/shopRegistry.ts */

import { resolveShopFromHostname as resolveFromRegistry } from '../src/config/shopRegistry'

export {
  buildShopDomainMap,
  isPlatformHost,
  isStaffPlatformHost,
  STAFF_PLATFORM_HOSTS,
  normalizeCustomDomain,
  normalizeHostname,
  parseShopDomainMapJson,
  resolveShopFromHostname,
  type ShopDomainResolveResult,
  type ShopDomainResolveSource,
} from '../src/config/shopRegistry'

/** @deprecated alias — prefer resolveShopFromHostname for alert metadata */
export function resolveSlugFromHostname(host: string, envMapJson?: string): string | null {
  return resolveFromRegistry(host, envMapJson).slug
}
