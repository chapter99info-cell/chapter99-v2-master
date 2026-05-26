/* Trip2Talk — Web Push handler (imported by Workbox service worker) */

self.addEventListener('push', (event) => {
  let payload = { title: 'Trip2Talk', body: 'New payment received', url: '/staff' }
  try {
    if (event.data) payload = { ...payload, ...event.data.json() }
  } catch {
    /* ignore */
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || 'Trip2Talk', {
      body: payload.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: payload.reference_number || 'trip2talk-payment',
      data: { url: payload.url || '/staff', fb_text: payload.fb_text || '' },
      requireInteraction: true,
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/staff'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(target) && 'focus' in client) {
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
