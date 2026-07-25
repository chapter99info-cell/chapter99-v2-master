// Ask the service worker to precache / refresh signage video URLs (Cache API).

const DEFAULT_REFRESH_MINUTES = 360

export async function syncSignageVideoCache(
  shopId: string,
  urls: string[]
): Promise<void> {
  const unique = [...new Set(urls.map((u) => u.trim()).filter(Boolean))]
  if (!('serviceWorker' in navigator)) return

  const reg = await navigator.serviceWorker.ready
  const worker = reg.active || navigator.serviceWorker.controller
  if (!worker) return

  await new Promise<void>((resolve) => {
    const channel = new MessageChannel()
    const timer = window.setTimeout(() => resolve(), 120_000)
    channel.port1.onmessage = () => {
      window.clearTimeout(timer)
      resolve()
    }
    worker.postMessage({ type: 'SIGNAGE_SYNC', shopId, urls: unique }, [
      channel.port2,
    ])
  })
}

/**
 * Re-sync on an interval (minutes from signage_config / get_signage_data),
 * plus when the Fire Stick tab becomes visible again.
 */
export function attachSignageCacheRefresh(
  shopId: string,
  getUrls: () => string[],
  getIntervalMinutes?: () => number
): () => void {
  let cancelled = false
  let intervalId: number | null = null

  const run = () => {
    if (cancelled) return
    void syncSignageVideoCache(shopId, getUrls())
  }

  const schedule = () => {
    if (intervalId != null) window.clearInterval(intervalId)
    const minutes = Math.max(
      1,
      getIntervalMinutes?.() ?? DEFAULT_REFRESH_MINUTES
    )
    intervalId = window.setInterval(run, minutes * 60 * 1000)
  }

  run()
  schedule()

  /* Re-read interval after config may have updated (e.g. loadBundle). */
  const rescheduleId = window.setInterval(schedule, 60_000)

  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }
  const onFocus = () => run()

  document.addEventListener('visibilitychange', onVisible)
  window.addEventListener('focus', onFocus)

  return () => {
    cancelled = true
    if (intervalId != null) window.clearInterval(intervalId)
    window.clearInterval(rescheduleId)
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('focus', onFocus)
  }
}
