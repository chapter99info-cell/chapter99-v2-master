import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Resend } from 'resend'
import { RECEIPTS_FROM } from './emailConstants'
import {
  buildBookingConfirmationHTML,
  buildBookingConfirmationSubject,
  buildBookingConfirmationText,
  type BookingConfirmationEmailPayload,
} from './bookingConfirmationEmailTemplate'

export async function POST_bookingConfirmationEmail(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured' })
  }

  const body = req.body as Partial<BookingConfirmationEmailPayload>
  if (!body.to?.trim()) {
    return res.status(400).json({ error: 'Missing recipient email' })
  }
  if (!body.clientName?.trim() || !body.serviceName?.trim() || !body.shopName?.trim()) {
    return res.status(400).json({ error: 'Missing booking details' })
  }

  const payload: BookingConfirmationEmailPayload = {
    to: body.to.trim(),
    clientName: body.clientName.trim(),
    serviceName: body.serviceName.trim(),
    durationMin: Number(body.durationMin) || 0,
    date: body.date?.trim() || '',
    time: body.time?.trim() || '',
    therapistLabel: body.therapistLabel?.trim() || 'No preference',
    shopName: body.shopName.trim(),
    shopAddress: body.shopAddress?.trim(),
    shopPhone: body.shopPhone?.trim(),
    shopEmail: body.shopEmail?.trim(),
    logoUrl: body.logoUrl?.trim(),
    bookingRef: body.bookingRef?.trim() || 'BK-PENDING',
    cancelUrl: body.cancelUrl?.trim(),
    totalPrice: body.totalPrice != null ? Number(body.totalPrice) : undefined,
  }

  try {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: RECEIPTS_FROM,
      to: payload.to,
      subject: buildBookingConfirmationSubject(payload.shopName),
      html: buildBookingConfirmationHTML(payload),
      text: buildBookingConfirmationText(payload),
    })

    return res.status(200).json({ success: true, id: result.data?.id })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email send failed'
    console.error('[email booking_confirmation]', message)
    return res.status(500).json({ error: message })
  }
}
