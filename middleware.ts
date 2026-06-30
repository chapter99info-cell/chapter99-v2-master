import {
  isPlatformHost,
  normalizeHostname,
  resolveShopFromHostname,
} from './lib/shopDomainMap'
import { alertUnmappedShopDomain } from './lib/shopDomainAlert'

export const config = {
  matcher: ['/((?!api/).*)'],
}

const SHOP_QUERY = 'shop'

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const host = normalizeHostname(url.hostname)

  if (isPlatformHost(host)) {
    return fetch(request)
  }

  const mapJson = process.env.SHOP_DOMAIN_MAP
  const resolved = resolveShopFromHostname(host, mapJson)

  if (resolved.needsAlert) {
    void alertUnmappedShopDomain({
      host: resolved.host,
      source: 'middleware',
      path: url.pathname,
    })
  }

  const slug = resolved.slug
  if (!slug || url.searchParams.get(SHOP_QUERY)?.trim()) {
    return fetch(request)
  }

  url.searchParams.set(SHOP_QUERY, slug)
  return Response.redirect(url.toString(), 307)
}
