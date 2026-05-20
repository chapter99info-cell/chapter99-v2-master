/**
 * POST /api/email-voucher — send gift voucher email via Resend
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { POST_giftVoucherEmail } from './gift-voucher-email'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') return POST_giftVoucherEmail(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
