/** Hostname → shop slug map (edge-safe, no import.meta). */

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

export function resolveSlugFromHostname(
  host: string,
  mapJson?: string
): string | null {
  const h = normalizeHostname(host)
  if (!h || isPlatformHost(h)) return null
  const map = parseShopDomainMapJson(mapJson)
  return map[h] ?? null
}
