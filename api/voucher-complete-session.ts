/**
 * POST /api/voucher-complete-session
 * After Stripe Checkout success — idempotent voucher creation + email
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from '../server/supabaseServer'
import {
  createStripeClient,
  getStripeSecret,
  parseJsonBody,
  sendJsonError,
  stripeErrorMessage,
} from '../server/apiUtils'
import { Resend } from 'resend'
import {
  buildGiftVoucherEmailHTML,
  buildGiftVoucherEmailSubject,
  buildGiftVoucherEmailText,
} from '../server/giftVoucherEmailTemplate'
import { VOUCHERS_FROM } from '../server/emailConstants'
import { withJsonApi } from '../server/jsonApi'

function oneYearFromToday(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

const ROUTE = 'voucher-complete-session'

async function voucherCompleteHandler(req: VercelRequest, res: VercelResponse) {
  console.log('SERVICE_ROLE_KEY present:', !!process.env.SUPABASE_SERVICE_ROLE_KEY)

  if (req.method !== 'POST') {
    return sendJsonError(res, 405, 'Method not allowed')
  }

  try {
    console.log(`[${ROUTE}] RESEND_API_KEY loaded:`, Boolean(process.env.RESEND_API_KEY))
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

    let supabase
    try {
      supabase = getServiceSupabase()
    } catch (e) {
      console.error(`[${ROUTE}] service supabase init failed`, e)
      return sendJsonError(res, 500, 'Supabase service role not configured')
    }

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
      console.error(`[${ROUTE}] voucher insert failed`, insertErr)
      return sendJsonError(res, 500, insertErr.message)
    }

    const { data: shop } = await supabase
      .from('shops')
      .select('name, address, phone, email, logo_url')
      .eq('id', shopId)
      .single()

    const resendKey = process.env.RESEND_API_KEY?.trim() ?? ''
    if (resendKey) {
      const resend = new Resend(resendKey)
      const payload = {
        to: recipientEmail,
        buyerName: recipientName ?? 'Guest',
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
        const result = await resend.emails.send({
          from: VOUCHERS_FROM,
          to: recipientEmail,
          subject: buildGiftVoucherEmailSubject(payload),
          html: buildGiftVoucherEmailHTML(payload),
          text: buildGiftVoucherEmailText(payload),
        })
        console.log(`[${ROUTE}] email sent`, { id: result.data?.id })
      } catch (e) {
        console.error(`[${ROUTE}] email failed`, e)
      }
    } else {
      console.warn(`[${ROUTE}] RESEND_API_KEY missing — skipping voucher email`)
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
