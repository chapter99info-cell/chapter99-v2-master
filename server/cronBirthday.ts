import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { getServiceSupabase } from './supabaseServer'
import { sendShopSms } from './smsGateway'
import { RECEIPTS_FROM } from './emailConstants'

function todayMonthDaySydney(): string {
  const parts = new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Sydney',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const mm = parts.find(p => p.type === 'month')?.value ?? '01'
  const dd = parts.find(p => p.type === 'day')?.value ?? '01'
  return `${mm}-${dd}`
}

function birthdayCode(clientId: string): string {
  return `BDAY-${clientId.replace(/-/g, '').slice(0, 6).toUpperCase()}`
}

export async function runCronBirthday(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sb = getServiceSupabase()
  const md = todayMonthDaySydney()

  const { data: shops, error: shopsErr } = await sb
    .from('shops')
    .select('id, name, email, sms_enabled, plan')
    .eq('active', true)

  if (shopsErr) {
    return res.status(500).json({ error: shopsErr.message })
  }

  let sent = 0
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
  const expiresAt = new Date(Date.now() + 30 * 86400000).toISOString()

  for (const shop of shops ?? []) {
    const plan = String(shop.plan ?? 'starter').toLowerCase()
    if (plan !== 'business' && plan !== 'pro' && plan !== 'business_plus') continue

    const { data: clients } = await sb
      .from('clients')
      .select('id, name, email, phone, date_of_birth')
      .eq('shop_id', shop.id)
      .not('date_of_birth', 'is', null)

    for (const client of clients ?? []) {
      const dob = String(client.date_of_birth)
      const parts = dob.slice(5) // MM-DD from YYYY-MM-DD
      if (parts !== md) continue

      const code = birthdayCode(client.id as string)
      const name = (client.name as string) || 'there'
      const shopName = (shop.name as string) || 'us'

      const { data: existing } = await sb
        .from('discount_codes')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (!existing) {
        await sb.from('discount_codes').insert({
          code,
          client_id: client.id,
          shop_id: shop.id,
          discount_pct: 15,
          expires_at: expiresAt,
          used: false,
        })
      }

      const emailText =
        `Happy Birthday ${name}!\n\n` +
        `From all of us at ${shopName}, enjoy 15% off your next visit.\n` +
        `Use code: ${code} (valid 30 days).\n\n` +
        `Book online or call us today!`
      const smsText = `Happy Birthday ${name.split(' ')[0]}! ${shopName} gift: 15% off with ${code}. Valid 30 days.`

      let emailOk = false
      const email = (client.email as string | null)?.trim()
      if (email && resend) {
        const result = await resend.emails.send({
          from: RECEIPTS_FROM,
          to: email,
          subject: `Happy Birthday from ${shopName}! 🎂`,
          text: emailText,
        })
        emailOk = !result.error
      }

      const phone = (client.phone as string | null)?.trim()
      let smsOk = false
      if (phone && shop.sms_enabled) {
        const smsResult = await sendShopSms({
          shopId: shop.id as string,
          to: phone,
          message: smsText.slice(0, 160),
          priority: 'low',
        })
        smsOk = smsResult.sent
      }

      if (emailOk || smsOk) sent++
    }
  }

  return res.status(200).json({ sent })
}
