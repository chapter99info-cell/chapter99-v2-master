import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'
const SHOP_ID = process.env.VITE_SHOP_ID ?? process.env.SHOP_ID ?? 'shop-001'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    return res.status(500).json({ error: 'STRIPE_SECRET_KEY not configured' })
  }

  const body = req.body as {
    amount?: number
    recipientName?: string
    recipientEmail?: string
    buyerName?: string
    buyerEmail?: string
    shopId?: string
  }

  const amount = Math.round((Number(body.amount) || 0) * 100)
  if (amount < 500) {
    return res.status(400).json({ error: 'Minimum amount is $5' })
  }
  if (!body.recipientName?.trim() || !body.recipientEmail?.trim()) {
    return res.status(400).json({ error: 'Recipient name and email required' })
  }
  if (!body.buyerEmail?.trim()) {
    return res.status(400).json({ error: 'Buyer email required' })
  }

  const shopId = body.shopId?.trim() || SHOP_ID
  const origin =
    req.headers.origin ||
    (req.headers['x-forwarded-proto'] && req.headers.host
      ? `${req.headers['x-forwarded-proto']}://${req.headers.host}`
      : 'http://localhost:5173')

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: body.buyerEmail.trim(),
    line_items: [
      {
        price_data: {
          currency: 'aud',
          unit_amount: amount,
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
      amount_aud: String(amount / 100),
    },
    success_url: `${origin}/voucher?success=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/voucher?cancelled=1`,
  })

  return res.json({ url: session.url, sessionId: session.id })
}
