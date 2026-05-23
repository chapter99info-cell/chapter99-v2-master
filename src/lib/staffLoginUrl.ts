import { buildOriginForCustomDomain, isOnCustomShopDomain } from './shopDomain'
import { getPublicAppOrigin } from './menuUrl'

/** Origin for staff login links (custom domain or current app URL). */
export function getStaffLoginOrigin(customDomain?: string): string {
  const fromDomain = buildOriginForCustomDomain(customDomain)
  if (fromDomain) return fromDomain
  return getPublicAppOrigin()
}

export function buildStaffLoginUrl(slug: string, customDomain?: string): string {
  const key = slug.trim().toLowerCase()
  const origin = getStaffLoginOrigin(customDomain)
  const onCustom = Boolean(buildOriginForCustomDomain(customDomain)) || isOnCustomShopDomain()
  if (onCustom) return `${origin}/staff`
  return `${origin}/staff?shop=${encodeURIComponent(key)}`
}
