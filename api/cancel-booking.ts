import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from '../server/supabaseServer'
import { Resend } from 'resend'
import { sendShopSms } from '../server/smsGateway'
import { RECEIPTS_FROM } from '../server/emailConstants'
import { cancelBookingById } from '../server/bookingNotificationsCore'
import { refundBookingDepositIfEligible } from '../server/bookingDepositCore'

function supabaseAdmin() {
  return getServiceSupabase()
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method === 'GET') {
    const bookingId = String(req.query.booking ?? '')
    const shopSlug = String(req.query.shop ?? '')
    if (!bookingId || !shopSlug) {
      return res.status(400).json({ error: 'Missing booking or shop' })
    }

    const sb = supabaseAdmin()
    const { data: shop } = await sb
      .from('shops')
      .select('id, name, slug')
      .eq('slug', shopSlug.trim().toLowerCase())
      .maybeSingle()

    if (!shop) return res.status(404).json({ error: 'Shop not found' })

    const { data: booking } = await sb
      .from('bookings')
      .select(
        `
        id, status, start_time, end_time,
        services ( name_en, duration, price ),
        clients ( name, email, phone ),
        therapist_name
      `
      )
      .eq('id', bookingId)
      .eq('shop_id', shop.id)
      .maybeSingle()

    if (!booking) return res.status(404).json({ error: 'Booking not found' })

    return res.status(200).json({ shop, booking })
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { bookingId, shopSlug } = req.body as { bookingId?: string; shopSlug?: string }
  if (!bookingId?.trim() || !shopSlug?.trim()) {
    return res.status(400).json({ error: 'Missing bookingId or shopSlug' })
  }

  const sb = supabaseAdmin()
  const { data: before } = await sb
    .from('bookings')
    .select(
      `
      id, shop_id, status, start_time,
      shops ( name, phone, email, notification_email, slug ),
      services ( name_en ),
      clients ( name, email, phone )
    `
    )
    .eq('id', bookingId)
    .maybeSingle()

  let refundNote = ''
  if (before?.shop_id) {
    const refund = await refundBookingDepositIfEligible(bookingId, before.shop_id as string)
    if (refund.refunded) refundNote = ' Deposit refunded.'
  }

  const result = await cancelBookingById(bookingId, shopSlug)
  if (!result.ok) {
    return res.status(400).json({ error: result.error ?? 'Could not cancel' })
  }

  if (before && before.status !== 'cancelled') {
    const shop = before.shops as {
      name?: string
      phone?: string
      email?: string
      notification_email?: string
    } | null
    const svc = before.services as { name_en?: string } | null
    const client = before.clients as { name?: string; email?: string } | null
    const start = new Date(before.start_time as string)
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
    const ownerTo = shop?.notification_email?.trim() || shop?.email?.trim()
    const msg = `Booking cancelled: ${client?.name ?? 'Guest'} — ${svc?.name_en ?? 'Service'} on ${dateLabel} at ${time}.${refundNote}`

    if (process.env.RESEND_API_KEY && ownerTo) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      void resend.emails.send({
        from: RECEIPTS_FROM,
        to: ownerTo,
        subject: `Booking cancelled — ${shop?.name ?? 'Shop'}`,
        html: `<p>${msg}</p>`,
        text: msg,
      })
    }

    if (shop?.phone && shop?.id) {
      void sendShopSms({
        shopId: shop.id,
        to: shop.phone,
        priority: 'critical',
        message: msg,
      })
    }

    if (client?.email && process.env.RESEND_API_KEY) {
      const resend = new Resend(process.env.RESEND_API_KEY)
      void resend.emails.send({
        from: RECEIPTS_FROM,
        to: client.email,
        subject: `Booking cancelled — ${shop?.name ?? ''}`,
        html: `<p>Hi ${client.name ?? 'there'}, your booking on ${dateLabel} at ${time} has been cancelled. Contact us if this was a mistake.</p>`,
      })
    }
  }

  return res.status(200).json({ success: true })
}
