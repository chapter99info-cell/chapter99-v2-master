/**
 * PART 5.6 — Send review request 2 hours after booking completed.
 */
import { Resend } from 'resend'
import { getServiceSupabase } from './supabaseServer'
import { sendShopSms } from './smsGateway'
import { RECEIPTS_FROM } from './emailConstants'

function reviewUrl(bookingId: string, shopSlug?: string): string {
  const base = process.env.VITE_APP_URL || process.env.VERCEL_URL
    ? `https://${(process.env.VITE_APP_URL || process.env.VERCEL_URL || '').replace(/^https?:\/\//, '')}`
    : 'https://chapter99.com.au'
  const path = `/review/${bookingId}`
  return shopSlug ? `${base}/spa${path}` : `${base}${path}`
}

export async function processReviewSentimentRequests(): Promise<{
  checked: number
  sent: number
}> {
  const sb = getServiceSupabase()
  const now = Date.now()
  const windowEnd = new Date(now - 2 * 60 * 60 * 1000).toISOString()
  const windowStart = new Date(now - 3 * 60 * 60 * 1000).toISOString()

  const { data: rows, error } = await sb
    .from('bookings')
    .select(
      `
      id, shop_id, status, start_time,
      shops ( name, slug, sms_enabled ),
      clients ( name, email, phone )
    `
    )
    .eq('status', 'completed')
    .is('review_request_sent_at', null)
    .gte('start_time', windowStart)
    .lte('start_time', windowEnd)

  if (error) {
    throw new Error(error.message)
  }

  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  let sent = 0

  for (const row of rows ?? []) {
    const shop = row.shops as { name?: string; slug?: string; sms_enabled?: boolean } | null
    const client = row.clients as { name?: string; email?: string; phone?: string } | null
    const shopName = shop?.name ?? 'our spa'
    const name = client?.name ?? 'there'
    const link = reviewUrl(row.id as string, shop?.slug)
    const subject = `How was your massage at ${shopName}?`
    const text =
      `Hi ${name},\n\nHow was your massage? Please rate us 1–5 stars:\n${link}\n\nThank you!\n${shopName}`

    let delivered = false

    const email = client?.email?.trim()
    if (email && resend) {
      const result = await resend.emails.send({
        from: RECEIPTS_FROM,
        to: email,
        subject,
        text,
        html: `<p>Hi ${name},</p><p>How was your massage? <a href="${link}">Rate us 1–5 stars</a></p><p>Thank you!<br>${shopName}</p>`,
      })
      if (!result.error) delivered = true
    }

    const phone = client?.phone?.trim()
    if (phone && shop?.sms_enabled) {
      const sms = `Hi ${name.split(' ')[0]}, how was your massage at ${shopName}? Rate 1-5: ${link}`
      const smsResult = await sendShopSms({
        shopId: row.shop_id as string,
        to: phone,
        message: sms.slice(0, 160),
        priority: 'low',
      })
      if (smsResult.sent) delivered = true
    }

    if (delivered) {
      await sb
        .from('bookings')
        .update({ review_request_sent_at: new Date().toISOString() })
        .eq('id', row.id)
      sent++
    }
  }

  return { checked: rows?.length ?? 0, sent }
}

export async function runCronReviewSentiment(
  req: import('@vercel/node').VercelRequest,
  res: import('@vercel/node').VercelResponse
) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const result = await processReviewSentimentRequests()
    return res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'review sentiment failed'
    return res.status(500).json({ error: message })
  }
}
