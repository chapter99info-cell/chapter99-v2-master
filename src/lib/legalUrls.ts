import type { Shop } from '../types/pos'

export function isExternalLegalUrl(url: string): boolean {
  return /^https?:\/\//i.test(url.trim())
}

/** Custom URL if set; otherwise built-in /privacy page. */
export function resolvePrivacyPolicyHref(
  shop: Pick<Shop, 'privacyPolicyUrl'> | null | undefined,
  withShopQuery: (path: string) => string
): string {
  const custom = shop?.privacyPolicyUrl?.trim()
  if (custom) return custom
  return withShopQuery('/privacy')
}

/** Custom URL if set; otherwise built-in /terms page. */
export function resolveTermsHref(
  shop: Pick<Shop, 'termsUrl'> | null | undefined,
  withShopQuery: (path: string) => string
): string {
  const custom = shop?.termsUrl?.trim()
  if (custom) return custom
  return withShopQuery('/terms')
}
