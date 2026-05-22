// Chapter99 — in-app notifications (Alerts panel)

export interface BookingNotificationPayload {
  type: 'booking'
  clientName: string
  serviceName: string
  appointmentAt: string
  therapist: string | null
  room: string | null
  source: string
  bookedAt: string
}

export interface NotificationRow {
  id: string
  shop_id: string
  booking_id: string | null
  message: string
  is_read: boolean
  created_at: string
}

export interface AppNotification {
  id: string
  shopId: string
  bookingId: string | null
  isRead: boolean
  createdAt: string
  payload: BookingNotificationPayload | null
  rawMessage: string
}

export function mapRowToNotification(row: NotificationRow): AppNotification {
  let payload: BookingNotificationPayload | null = null
  try {
    const parsed = JSON.parse(row.message) as Partial<BookingNotificationPayload>
    if (parsed?.type === 'booking' && parsed.clientName && parsed.serviceName) {
      payload = {
        type: 'booking',
        clientName: parsed.clientName,
        serviceName: parsed.serviceName,
        appointmentAt: parsed.appointmentAt ?? row.created_at,
        therapist: parsed.therapist ?? null,
        room: parsed.room ?? null,
        source: parsed.source ?? 'online',
        bookedAt: parsed.bookedAt ?? row.created_at,
      }
    }
  } catch {
    /* legacy plain-text messages */
  }

  return {
    id: row.id,
    shopId: row.shop_id,
    bookingId: row.booking_id,
    isRead: row.is_read,
    createdAt: row.created_at,
    payload,
    rawMessage: row.message,
  }
}
