import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
import { getServiceSupabase } from '../server/supabaseServer'
import { Resend } from 'resend'
import {
  buildGiftVoucherEmailHTML,
  buildGiftVoucherEmailSubject,
  buildGiftVoucherEmailText,
} from '../server/giftVoucherEmailTemplate'

function oneYearFromToday(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret || !webhookSecret) {
    return res.status(500).json({ error: 'Stripe not configured' })
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })
  const sig = req.headers['stripe-signature'] as string
  const rawBody =
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body)

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Invalid signature'
    return res.status(400).json({ error: message })
  }

  if (event.type !== 'checkout.session.completed') {
    return res.json({ received: true })
  }

  const session = event.data.object as Stripe.Checkout.Session
  const meta = session.metadata ?? {}

  if (meta.purpose === 'booking_deposit') {
    try {
      const { completeBookingDepositSession } = await import('../server/bookingDepositCore.js')
      const origin =
        process.env.PUBLIC_APP_URL?.trim() ||
        process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : 'https://chapter99-v4-complete.vercel.app'
      await completeBookingDepositSession(session, origin)
      return res.json({ received: true, bookingDeposit: true })
    } catch (e) {
      console.error('[stripe-webhook] booking deposit', e)
      return res.status(500).json({ error: 'Booking deposit completion failed' })
    }
  }

  const shopId = meta.shop_id
  const amount = parseFloat(meta.amount_aud || '0')
  const recipientEmail = meta.recipient_email
  const recipientName = meta.recipient_name
  const buyerName = meta.buyer_name || recipientName
  const buyerEmail = meta.buyer_email

  if (!shopId || amount <= 0 || !recipientEmail) {
    console.error('[stripe-webhook] missing metadata', meta)
    return res.status(400).json({ error: 'Invalid session metadata' })
  }

  const supabase = getServiceSupabase()

  const expiryDate = oneYearFromToday()

  const { data: voucher, error: insertErr } = await supabase
    .from('gift_vouchers')
    .insert({
      shop_id: shopId,
      original_amount: amount,
      remaining_balance: amount,
      expiry_date: expiryDate,
      status: 'active',
      purchased_via: 'web',
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      stripe_session_id: session.id,
    })
    .select()
    .single()

  if (insertErr) {
    console.error('[stripe-webhook] voucher insert', insertErr)
    return res.status(500).json({ error: insertErr.message })
  }

  const { data: shop } = await supabase
    .from('shops')
    .select('name, address, phone, email, logo_url')
    .eq('id', shopId)
    .single()

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const payload = {
      to: recipientEmail,
      buyerName: recipientName,
      voucherCode: voucher.code as string,
      amount,
      expiryDate,
      shopName: (shop?.name as string) || 'Chapter99',
      shopAddress: (shop?.address as string) || '',
      shopPhone: (shop?.phone as string) || '',
      shopEmail: shop?.email as string | undefined,
      logoUrl: shop?.logo_url as string | undefined,
    }
    try {
      await resend.emails.send({
        from: 'Chapter99 Gift Vouchers <onboarding@resend.dev>',
        to: recipientEmail,
        subject: buildGiftVoucherEmailSubject(payload),
        html: buildGiftVoucherEmailHTML(payload),
        text: buildGiftVoucherEmailText(payload),
      })
    } catch (emailErr) {
      console.error('[stripe-webhook] email failed', emailErr)
    }
  }

  return res.json({ received: true, voucherCode: voucher.code })
}

