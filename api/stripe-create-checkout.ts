import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createStripeClient,
  getRequestOrigin,
  getStripeSecret,
  parseJsonBody,
  sendJsonError,
  stripeErrorMessage,
} from './apiUtils'

const ROUTE = 'stripe-create-checkout'
const SHOP_ID = process.env.VITE_SHOP_ID ?? process.env.SHOP_ID ?? 'shop-001'

interface CheckoutBody {
  amount?: number
  recipientName?: string
  recipientEmail?: string
  buyerName?: string
  buyerEmail?: string
  shopId?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')

  if (req.method !== 'POST') {
    return sendJsonError(res, 405, 'Method not allowed')
  }

  try {
    const secret = getStripeSecret(ROUTE)
    if (!secret) {
      return sendJsonError(
        res,
        500,
        'STRIPE_SECRET_KEY is not configured on the server'
      )
    }

    const body = parseJsonBody<CheckoutBody>(req)

    const amountCents = Math.round((Number(body.amount) || 0) * 100)
    if (amountCents < 500) {
      return sendJsonError(res, 400, 'Minimum amount is $5')
    }
    if (!body.recipientName?.trim() || !body.recipientEmail?.trim()) {
      return sendJsonError(res, 400, 'Recipient name and email required')
    }
    if (!body.buyerEmail?.trim()) {
      return sendJsonError(res, 400, 'Buyer email required')
    }

    const shopId = body.shopId?.trim() || SHOP_ID
    const origin = getRequestOrigin(req)
    const stripe = createStripeClient(secret)

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: body.buyerEmail.trim(),
      line_items: [
        {
          price_data: {
            currency: 'aud',
            unit_amount: amountCents,
            product_data: {
              name: 'Chapter99 Gift Voucher',
              description: `For ${body.recipientName.trim()}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        shop_id: shopId,
        recipient_name: body.recipientName.trim(),
        recipient_email: body.recipientEmail.trim(),
        buyer_name: body.buyerName?.trim() || body.recipientName.trim(),
        buyer_email: body.buyerEmail.trim(),
        amount_aud: String(amountCents / 100),
      },
      success_url: `${origin}/voucher?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/voucher?cancelled=1`,
    })

    if (!session.url) {
      return sendJsonError(res, 500, 'Stripe did not return a checkout URL')
    }

    return res.status(200).json({ url: session.url, sessionId: session.id })
  } catch (err) {
    console.error(`[${ROUTE}]`, err)
    return sendJsonError(res, 500, stripeErrorMessage(err), String(err))
  }
}
