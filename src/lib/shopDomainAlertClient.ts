import { isPlatformHost, resolveShopFromHostname } from '../../lib/shopDomainMap'

const CLIENT_MAP_JSON =
  (import.meta.env.VITE_SHOP_DOMAIN_MAP as string | undefined) ??
  (import.meta.env.SHOP_DOMAIN_MAP as string | undefined)

const reportedHosts = new Set<string>()

/** Client-side: warn in console + POST once per host to /api/shop-domain-alert */
export function reportUnmappedShopDomainClient(payload: {
  host: string
  source: string
  path?: string
}): void {
  if (typeof window === 'undefined') return

  const host = payload.host.trim().toLowerCase()
  if (!host || isPlatformHost(host) || reportedHosts.has(host)) return

  const resolved = resolveShopFromHostname(host, CLIENT_MAP_JSON)
  if (!resolved.needsAlert) return

  reportedHosts.add(host)

  if (import.meta.env.DEV) {
    console.warn(
      `[shop-domain] Unmapped custom domain "${host}" (${payload.source}). ` +
        'Add it to shops.config.json and redeploy.'
    )
  }

  void fetch('/api/shop-domain-alert', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      host,
      source: payload.source,
      path: payload.path ?? window.location.pathname,
    }),
  }).catch(() => {
    /* non-blocking */
  })
}
