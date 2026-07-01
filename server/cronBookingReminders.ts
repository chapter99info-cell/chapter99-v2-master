import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './supabaseServer'
import { markReminderSent, sendBookingReminderSms } from './bookingNotificationsCore'

export async function runCronBookingReminders(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  let sb
  try {
    sb = getServiceSupabase()
  } catch {
    return res.status(500).json({ error: 'Supabase not configured' })
  }
  const now = Date.now()
  const windowStart = new Date(now + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(now + 25 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await sb
    .from('bookings')
    .select(
      `
      id, shop_id, start_time,
      shops ( name, phone ),
      services ( name_en ),
      clients ( name, phone )
    `
    )
    .in('status', ['confirmed', 'deposit_paid'])
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
      shopId: row.shop_id as string,
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
