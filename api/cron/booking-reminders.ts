import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  markReminderSent,
  sendBookingReminderSms,
} from '../../server/bookingNotificationsCore'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) {
    return res.status(500).json({ error: 'Supabase not configured' })
  }

  const sb = createClient(url, key)
  const now = Date.now()
  const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await sb
    .from('bookings')
    .select(
      `
      id, start_time,
      shops ( name, phone ),
      services ( name_en ),
      clients ( name, phone )
    `
    )
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .gte('start_time', windowStart)
    .lte('start_time', windowEnd)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  let sent = 0
  for (const row of rows ?? []) {
    const client = row.clients as { name?: string; phone?: string } | null
    const shop = row.shops as { name?: string; phone?: string } | null
    const svc = row.services as { name_en?: string } | null
    const phone = client?.phone?.trim()
    if (!phone) continue

    const start = new Date(row.start_time as string)
    const dateLabel = start.toLocaleDateString('en-AU', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'Australia/Sydney',
    })
    const time = start.toLocaleTimeString('en-AU', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Australia/Sydney',
    })

    const ok = await sendBookingReminderSms({
      clientPhone: phone,
      clientName: client?.name ?? 'Guest',
      serviceName: svc?.name_en ?? 'your appointment',
      dateLabel,
      time,
      shopName: shop?.name ?? 'us',
      shopPhone: shop?.phone ?? undefined,
    })

    if (ok) {
      await markReminderSent(row.id as string)
      sent++
    }
  }

  return res.status(200).json({ checked: rows?.length ?? 0, sent })
}
