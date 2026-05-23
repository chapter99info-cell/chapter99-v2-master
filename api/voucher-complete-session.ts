/**
 * POST /api/voucher-complete-session
 * After Stripe Checkout success — idempotent voucher creation + email
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import {
  createStripeClient,
  getStripeSecret,
  parseJsonBody,
  sendJsonError,
  stripeErrorMessage,
} from './apiUtils'
import { Resend } from 'resend'
import {
  buildGiftVoucherEmailHTML,
  buildGiftVoucherEmailSubject,
  buildGiftVoucherEmailText,
} from './giftVoucherEmailTemplate'
import { VOUCHERS_FROM } from './emailConstants'
import { withJsonApi } from './jsonApi'

function oneYearFromToday(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const ROUTE = 'voucher-complete-session'

async function voucherCompleteHandler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJsonError(res, 405, 'Method not allowed')
  }

  try {
    const secret = getStripeSecret(ROUTE)
    if (!secret) {
      return sendJsonError(res, 500, 'STRIPE_SECRET_KEY is not configured on the server')
    }

    const { sessionId } = parseJsonBody<{ sessionId?: string }>(req)
    if (!sessionId?.trim()) {
      return sendJsonError(res, 400, 'sessionId required')
    }

    const stripe = createStripeClient(secret)
    const session = await stripe.checkout.sessions.retrieve(sessionId)

    if (session.payment_status !== 'paid') {
      return sendJsonError(res, 400, 'Payment not completed')
    }

    const supabase = createClient(
      process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? ''
    )

    const { data: existing } = await supabase
      .from('gift_vouchers')
      .select('code, original_amount, expiry_date')
      .eq('stripe_session_id', sessionId)
      .maybeSingle()

    if (existing) {
      return res.status(200).json({
        success: true,
        voucherCode: existing.code,
        amount: existing.original_amount,
        expiryDate: existing.expiry_date,
        alreadyCreated: true,
      })
    }

    const meta = session.metadata ?? {}
    const shopId = meta.shop_id
    const amount = parseFloat(meta.amount_aud || '0')
    const recipientEmail = meta.recipient_email
    const recipientName = meta.recipient_name
    const buyerName = meta.buyer_name || recipientName
    const buyerEmail = meta.buyer_email

    if (!shopId || amount <= 0 || !recipientEmail) {
      return sendJsonError(res, 400, 'Invalid checkout session')
    }

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
        stripe_session_id: sessionId,
      })
      .select()
      .single()

    if (insertErr) {
      return sendJsonError(res, 500, insertErr.message)
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
          from: VOUCHERS_FROM,
          to: recipientEmail,
          subject: buildGiftVoucherEmailSubject(payload),
          html: buildGiftVoucherEmailHTML(payload),
          text: buildGiftVoucherEmailText(payload),
        })
      } catch (e) {
        console.error('[voucher-complete] email', e)
      }
    }

    return res.status(200).json({
      success: true,
      voucherCode: voucher.code,
      amount,
      expiryDate,
    })
  } catch (err) {
    console.error(`[${ROUTE}]`, err)
    return sendJsonError(res, 500, stripeErrorMessage(err), String(err))
  }
}

export default withJsonApi(voucherCompleteHandler)
