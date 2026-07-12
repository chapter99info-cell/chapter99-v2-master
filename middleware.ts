import {
  normalizeHostname,
  resolveShopFromHostname,
} from './src/config/shopRegistry'
import { alertUnmappedShopDomain } from './lib/shopDomainAlert'

export const config = {
  matcher: ['/((?!api/).*)'],
}

const SHOP_QUERY = 'shop'

function isStaticPassThrough(path: string): boolean {
  return (
    path.startsWith('/downloads/') ||
    path.startsWith('/assets/') ||
    /\.(?:apk|txt|xml|ico|png|jpe?g|webp|svg|css|js|map|webmanifest)$/i.test(path)
  )
}

export default function middleware(request: Request) {
  const url = new URL(request.url)
  const host = normalizeHostname(url.hostname)
  const path = url.pathname

  // APK + other static files must not get ?shop= rewritten
  if (isStaticPassThrough(path)) {
    return fetch(request)
  }

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
