export const ADMIN_PIN = '2605'
export const ADMIN_STORAGE_KEY = 't2t_admin'
const SESSION_MS = 24 * 60 * 60 * 1000

export function setAdminSession(): void {
  localStorage.setItem(ADMIN_STORAGE_KEY, String(Date.now()))
}

export function clearAdminSession(): void {
  localStorage.removeItem(ADMIN_STORAGE_KEY)
}

export function isAdminSessionValid(): boolean {
  const raw = localStorage.getItem(ADMIN_STORAGE_KEY)
  if (!raw) return false
  const ts = Number(raw)
  if (!Number.isFinite(ts)) return false
  return Date.now() - ts < SESSION_MS
}
