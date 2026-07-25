/* Signage video Cache API — imported by Workbox SW (vite-plugin-pwa).
 * Page posts { type: 'SIGNAGE_SYNC', shopId, urls } to precache clips.
 * Fetch handler: cache-first ONLY for video URLs (leaves Workbox alone for app shell).
 */

const SIGNAGE_CACHE_PREFIX = 'signage-videos-'

function signageCacheName(shopId) {
  return SIGNAGE_CACHE_PREFIX + String(shopId || 'unknown')
}

function isSignageVideoRequest(request) {
  if (request.method !== 'GET') return false
  const url = request.url
  return /\.(mp4|webm|mov)(\?|$)/i.test(url) || /\/shop-assets\//i.test(url)
}

async function syncSignageCache(shopId, urls) {
  const name = signageCacheName(shopId)
  const cache = await caches.open(name)
  const wanted = new Set((urls || []).filter(Boolean).map(String))

  const existing = await cache.keys()
  await Promise.all(
    existing.map(async (req) => {
      if (!wanted.has(req.url)) await cache.delete(req)
    })
  )

  await Promise.all(
    [...wanted].map(async (url) => {
      const hit = await cache.match(url)
      if (hit) return
      try {
        const res = await fetch(url, { mode: 'cors', credentials: 'omit' })
        if (res.ok) await cache.put(url, res.clone())
      } catch {
        /* network may return later */
      }
    })
  )
}

async function matchSignageCache(request) {
  const keys = await caches.keys()
  const signageKeys = keys.filter((k) => k.startsWith(SIGNAGE_CACHE_PREFIX))
  for (const key of signageKeys) {
    const cache = await caches.open(key)
    const hit = await cache.match(request)
    if (hit) return hit
  }
  return null
}

self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'SIGNAGE_SYNC') return
  const shopId = data.shopId
  const urls = Array.isArray(data.urls) ? data.urls : []
  event.waitUntil(
    syncSignageCache(shopId, urls).then(() => {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ ok: true, count: urls.length })
      }
    })
  )
})

self.addEventListener('fetch', (event) => {
  if (!isSignageVideoRequest(event.request)) return

  event.respondWith(
    (async () => {
      const cached = await matchSignageCache(event.request)
      if (cached) return cached
      try {
        return await fetch(event.request)
      } catch (err) {
        const again = await matchSignageCache(event.request)
        if (again) return again
        throw err
      }
    })()
  )
})
