// Last-known queue snapshot for offline read-only viewing

const PREFIX = 'chapter99-queue-cache:'

export interface QueueCachePayload {
  savedAt: string
  bookings: unknown[]
  briefing: unknown | null
}

export function queueCacheKey(shopId: string, date: string, staffId?: string): string {
  return `${PREFIX}${shopId}:${date}:${staffId ?? 'all'}`
}

export function saveQueueCache(
  shopId: string,
  date: string,
  bookings: unknown[],
  briefing: unknown | null,
  staffId?: string
): void {
  try {
    const payload: QueueCachePayload = {
      savedAt: new Date().toISOString(),
      bookings,
      briefing,
    }
    localStorage.setItem(queueCacheKey(shopId, date, staffId), JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}

export function loadQueueCache(
  shopId: string,
  date: string,
  staffId?: string
): QueueCachePayload | null {
  try {
    const raw = localStorage.getItem(queueCacheKey(shopId, date, staffId))
    if (!raw) return null
    return JSON.parse(raw) as QueueCachePayload
  } catch {
    return null
  }
}
