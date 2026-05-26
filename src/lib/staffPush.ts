import { supabase } from './supabase'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export function isStaffPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getStaffPushPermission(): Promise<NotificationPermission> {
  if (!isStaffPushSupported()) return 'denied'
  return Notification.permission
}

export async function registerStaffPush(role = 'GUIDE'): Promise<{
  ok: boolean
  error?: string
}> {
  const vapidPublic = import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim()
  if (!vapidPublic) {
    return { ok: false, error: 'VITE_VAPID_PUBLIC_KEY not set' }
  }
  if (!isStaffPushSupported()) {
    return { ok: false, error: 'Push not supported on this browser' }
  }

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, error: 'Notification permission denied' }
    }

    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
      })
    }

    const json = subscription.toJSON()
    const keys = json.keys
    if (!json.endpoint || !keys?.p256dh || !keys?.auth) {
      return { ok: false, error: 'Invalid push subscription' }
    }

    const { error } = await supabase.from('push_notifications').upsert(
      {
        endpoint: json.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        role,
        user_agent: navigator.userAgent.slice(0, 240),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'endpoint' }
    )

    if (error) throw new Error(error.message)
    return { ok: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export function showLocalPaymentNotification(title: string, body: string): void {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, {
      body,
      icon: '/icons/icon-192.png',
      tag: 'trip2talk-payment-local',
    })
  } catch {
    /* ignore */
  }
}
