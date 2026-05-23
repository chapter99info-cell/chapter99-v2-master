import {
  isPlatformHost,
  normalizeHostname,
  resolveSlugFromHostname,
} from './lib/shopDomainMap'

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
  const slug = resolveSlugFromHostname(host, mapJson)
  if (!slug || url.searchParams.get(SHOP_QUERY)?.trim()) {
    return fetch(request)
  }

  url.searchParams.set(SHOP_QUERY, slug)
  return Response.redirect(url.toString(), 307)
}
