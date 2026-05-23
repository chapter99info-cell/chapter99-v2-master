import { getPublicAppOrigin } from './menuUrl'

/** Origin for staff login links (custom domain or current app URL). */
export function getStaffLoginOrigin(domainHint?: string): string {
  const hint = domainHint?.trim()
  if (hint) {
    if (/^https?:\/\//i.test(hint)) return hint.replace(/\/$/, '')
    return `https://${hint.replace(/\/$/, '')}`
  }
  return getPublicAppOrigin()
}

export function buildStaffLoginUrl(slug: string, domainHint?: string): string {
  const key = slug.trim().toLowerCase()
  const origin = getStaffLoginOrigin(domainHint)
  return `${origin}/staff?shop=${encodeURIComponent(key)}`
}
