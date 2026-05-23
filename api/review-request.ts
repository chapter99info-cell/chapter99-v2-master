/**
 * POST /api/review-request
 * Send Google review request after POS checkout (email / SMS with 30-day rate limit).
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import twilio from 'twilio'
import { RECEIPTS_FROM } from '../server/emailConstants'
import {
  buildReviewRequestHTML,
  buildReviewRequestSms,
  buildReviewRequestSubject,
  buildReviewRequestText,
  type ReviewRequestChannel,
} from '../server/reviewRequestEmailTemplate'

const RATE_LIMIT_DAYS = 30

interface ReviewRequestBody {
  shopId: string
  clientName?: string
  clientEmail?: string
  clientPhone?: string
  preview?: boolean
  previewChannel?: ReviewRequestChannel
}

function normalizeEmail(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase()
}

function normalizePhone(phone: string | undefined): string {
  const raw = (phone ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('+')) return raw
  return `+61${raw.replace(/^0/, '')}`
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime()
  const now = Date.now()
  return (now - then) / (1000 * 60 * 60 * 24)
}

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) return null
  return createClient(url, key)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = (req.body ?? {}) as ReviewRequestBody
  const shopId = body.shopId?.trim()
  if (!shopId) {
    return res.status(400).json({ error: 'Missing shopId' })
  }

  const email = normalizeEmail(body.clientEmail)
  const phone = normalizePhone(body.clientPhone)
  const isPreview = body.preview === true

  if (!isPreview && !email && !phone) {
    return res.status(400).json({ error: 'Client email or phone required' })
  }

  const supabase = getServiceSupabase()
  if (!supabase) {
    return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' })
  }

  const { data: shop, error: shopErr } = await supabase
    .from('shops')
    .select(
      'id, name, logo_url, review_request_enabled, google_review_url, review_request_channel, addon_sms'
    )
    .eq('id', shopId)
    .maybeSingle()

  if (shopErr || !shop) {
    return res.status(404).json({ error: 'Shop not found' })
  }

  const reviewUrl = (shop.google_review_url as string | null)?.trim() ?? ''
  const channel = (shop.review_request_channel as ReviewRequestChannel) || 'email'
  const enabled = shop.review_request_enabled === true
  const shopName = (shop.name as string) || 'Our shop'
  const logoUrl = (shop.logo_url as string | null) ?? undefined
  const smsAllowed = shop.addon_sms === true

  if (!reviewUrl) {
    return res.status(400).json({ error: 'Google Review URL is not configured for this shop' })
  }

  if (!isPreview && !enabled) {
    return res.status(200).json({ ok: true, skipped: true, reason: 'disabled' })
  }

  const effectiveChannel = isPreview ? body.previewChannel ?? channel : channel
  const sendEmail =
    (effectiveChannel === 'email' || effectiveChannel === 'both') && (isPreview ? true : !!email)
  const sendSms =
    (effectiveChannel === 'sms' || effectiveChannel === 'both') &&
    (isPreview ? true : !!phone) &&
    smsAllowed

  if (!sendEmail && !sendSms) {
    return res.status(400).json({
      error: smsAllowed
        ? 'No contact method for selected channel'
        : 'SMS add-on not enabled — use Email or Both',
    })
  }

  let clientId: string | null = null
  let lastSent: string | null = null

  if (!isPreview) {
    if (email) {
      const { data: byEmail } = await supabase
        .from('clients')
        .select('id, last_review_request_sent')
        .eq('shop_id', shopId)
        .ilike('email', email)
        .maybeSingle()
      if (byEmail) {
        clientId = byEmail.id as string
        lastSent = (byEmail.last_review_request_sent as string | null) ?? null
      }
    }
    if (!clientId && phone) {
      const { data: byPhone } = await supabase
        .from('clients')
        .select('id, last_review_request_sent, email')
        .eq('shop_id', shopId)
        .eq('phone', phone)
        .maybeSingle()
      if (byPhone) {
        clientId = byPhone.id as string
        lastSent = (byPhone.last_review_request_sent as string | null) ?? null
      }
    }

    if (lastSent && daysSince(lastSent) < RATE_LIMIT_DAYS) {
      return res.status(200).json({
        ok: true,
        skipped: true,
        reason: 'rate_limited',
        daysSinceLast: Math.floor(daysSince(lastSent)),
      })
    }
  }

  const results: { email?: boolean; sms?: boolean } = {}

  if (sendEmail) {
    const to = isPreview ? email || process.env.REVIEW_REQUEST_PREVIEW_EMAIL : email
    if (!to) {
      return res.status(400).json({ error: 'Email required for preview' })
    }
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: 'RESEND_API_KEY is not configured' })
    }
    const resend = new Resend(process.env.RESEND_API_KEY)
    const payload = {
      to,
      clientName: body.clientName,
      shopName,
      googleReviewUrl: reviewUrl,
      logoUrl,
    }
    const emailResult = await resend.emails.send({
      from: RECEIPTS_FROM,
      to,
      subject: buildReviewRequestSubject(shopName),
      html: buildReviewRequestHTML(payload),
      text: buildReviewRequestText(payload),
    })
    if (emailResult.error) {
      console.error('[review-request] email failed', emailResult.error)
      return res.status(500).json({ error: emailResult.error.message })
    }
    results.email = true
  }

  if (sendSms) {
    const to = isPreview ? phone : phone
    if (!to) {
      return res.status(400).json({ error: 'Phone required for SMS preview' })
    }
    const sid = process.env.TWILIO_ACCOUNT_SID
    const token = process.env.TWILIO_AUTH_TOKEN
    const from = process.env.TWILIO_FROM_NUMBER
    if (!sid || !token || !from) {
      return res.status(500).json({ error: 'Twilio is not configured' })
    }
    const client = twilio(sid, token)
    try {
      await client.messages.create({
        body: buildReviewRequestSms(shopName, reviewUrl),
        from,
        to,
      })
      results.sms = true
    } catch (err) {
      console.error('[review-request] sms failed', err)
      const message = err instanceof Error ? err.message : 'SMS failed'
      return res.status(500).json({ error: message })
    }
  }

  if (!isPreview) {
    const now = new Date().toISOString()
    if (clientId) {
      await supabase
        .from('clients')
        .update({ last_review_request_sent: now })
        .eq('id', clientId)
    } else if (email || phone) {
      await supabase.from('clients').insert({
        shop_id: shopId,
        name: body.clientName?.trim() || 'Guest',
        email: email || null,
        phone: phone || null,
        last_review_request_sent: now,
      })
    }
  }

  return res.status(200).json({
    ok: true,
    sent: results,
    preview: isPreview,
  })
}
