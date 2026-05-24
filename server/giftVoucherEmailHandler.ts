import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { VOUCHERS_FROM } from './emailConstants'
import {
  buildGiftVoucherEmailHTML,
  buildGiftVoucherEmailSubject,
  buildGiftVoucherEmailText,
  type GiftVoucherEmailPayload,
} from './giftVoucherEmailTemplate'

export async function POST_giftVoucherEmail(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured' })
  }

  const body = req.body as Partial<GiftVoucherEmailPayload>

  if (!body.to?.trim()) {
    return res.status(400).json({ error: 'Missing recipient email' })
  }
  if (!body.voucherCode?.trim() || !body.shopName?.trim()) {
    return res.status(400).json({ error: 'Missing voucher or shop details' })
  }

  const payload: GiftVoucherEmailPayload = {
    to: body.to.trim(),
    buyerName: body.buyerName?.trim() || 'Guest',
    voucherCode: body.voucherCode.trim(),
    amount: Number(body.amount) || 0,
    expiryDate: body.expiryDate ?? '',
    shopName: body.shopName.trim(),
    shopAddress: body.shopAddress?.trim() ?? '',
    shopPhone: body.shopPhone?.trim() ?? '',
    shopEmail: body.shopEmail?.trim(),
    logoUrl: body.logoUrl?.trim(),
  }

  if (payload.amount <= 0) {
    return res.status(400).json({ error: 'Invalid voucher amount' })
  }

  const resend = new Resend(process.env.RESEND_API_KEY)

  try {
    const result = await resend.emails.send({
      from: VOUCHERS_FROM,
      to: payload.to,
      subject: buildGiftVoucherEmailSubject(payload),
      html: buildGiftVoucherEmailHTML(payload),
      text: buildGiftVoucherEmailText(payload),
    })

    return res.json({ success: true, id: result.data?.id })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    return res.status(500).json({ error: message })
  }
}
