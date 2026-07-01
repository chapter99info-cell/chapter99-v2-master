import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { getServiceSupabase } from './supabaseServer'
import { sendShopSms } from './smsGateway'
import { RECEIPTS_FROM } from './emailConstants'

const WINBACK_DAYS = 60
const RESEND_COOLDOWN_DAYS = 90

function daysAgoIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

export async function runCronWinback(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sb = getServiceSupabase()
  const cutoff = daysAgoIso(WINBACK_DAYS)
  const resendCutoff = new Date(Date.now() - RESEND_COOLDOWN_DAYS * 86400000).toISOString()

  const { data: shops, error: shopsErr } = await sb
    .from('shops')
    .select('id, name, email, sms_enabled, plan')
    .eq('active', true)

  if (shopsErr) {
    return res.status(500).json({ error: shopsErr.message })
  }

  let sent = 0
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  for (const shop of shops ?? []) {
    const plan = String(shop.plan ?? 'starter').toLowerCase()
    if (plan !== 'business' && plan !== 'pro' && plan !== 'business_plus') continue

    const { data: clients } = await sb
      .from('clients')
      .select('id, name, email, phone, last_visit, total_visits, winback_sent_at')
      .eq('shop_id', shop.id)
      .gte('total_visits', 2)
      .lt('last_visit', cutoff)
      .or(`winback_sent_at.is.null,winback_sent_at.lt.${resendCutoff}`)

    for (const client of clients ?? []) {
      const name = (client.name as string) || 'there'
      const shopName = (shop.name as string) || 'us'
      const emailBody = `Hi ${name},\n\nWe miss you at ${shopName}! It's been a while since your last visit.\n\nBook your next massage and enjoy 10% off with code COMEBACK10.\n\nSee you soon!\n${shopName}`
      const smsBody = `Hi ${name.split(' ')[0]}, we miss you at ${shopName}! Book now & save 10% with COMEBACK10. Reply STOP to opt out.`

      let emailOk = false
      const email = (client.email as string | null)?.trim()
      if (email && resend) {
        const result = await resend.emails.send({
          from: RECEIPTS_FROM,
          to: email,
          subject: `We miss you at ${shopName}!`,
          text: emailBody,
        })
        emailOk = !result.error
      }

      const phone = (client.phone as string | null)?.trim()
      let smsOk = false
      if (phone && shop.sms_enabled) {
        const smsResult = await sendShopSms({
          shopId: shop.id as string,
          to: phone,
          message: smsBody.slice(0, 160),
          priority: 'low',
        })
        smsOk = smsResult.sent
      }

      if (emailOk || smsOk) {
        await sb
          .from('clients')
          .update({ winback_sent_at: new Date().toISOString() })
          .eq('id', client.id)
        sent++
      }
    }
  }

  return res.status(200).json({ sent })
}
