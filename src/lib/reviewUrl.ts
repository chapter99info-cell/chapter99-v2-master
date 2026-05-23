/** Plain https URL for QR codes and review links (mobile scanners require a scheme). */
export function normalizeGoogleReviewUrl(raw: string): string {
  const trimmed = raw.trim()
  if (!trimmed) return ''

  if (/^https:\/\//i.test(trimmed)) return trimmed

  if (/^http:\/\//i.test(trimmed)) {
    return trimmed.replace(/^http:\/\//i, 'https://')
  }

  return `https://${trimmed.replace(/^\/+/, '')}`
}
