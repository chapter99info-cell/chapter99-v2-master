import {
  normalizeHostname,
  resolveShopFromHostname,
} from './src/config/shopRegistry'
import { alertUnmappedShopDomain } from './lib/shopDomainAlert'

export const config = {
  matcher: ['/((?!api/).*)'],
}

const SHOP_QUERY = 'shop'

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const host = normalizeHostname(url.hostname)
  const path = url.pathname

  if (path === '/shop-not-found' || path.startsWith('/shop-not-found/')) {
    return fetch(request)
  }

  const mapJson = process.env.SHOP_DOMAIN_MAP
  const resolved = resolveShopFromHostname(host, mapJson)

  if (!resolved.slug) {
    if (resolved.needsAlert) {
      void alertUnmappedShopDomain({
        host: resolved.host,
        source: 'middleware',
        path,
      })
    }
    const notFound = new URL('/shop-not-found', url.origin)
    notFound.searchParams.set('host', host)
    return Response.redirect(notFound.toString(), 302)
  }

  if (url.searchParams.get(SHOP_QUERY)?.trim()) {
    return fetch(request)
  }

  url.searchParams.set(SHOP_QUERY, resolved.slug)
  return Response.redirect(url.toString(), 307)
}
