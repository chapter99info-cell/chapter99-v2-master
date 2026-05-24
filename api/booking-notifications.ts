import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendBookingNotifications } from '../server/bookingNotificationsCore'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body as Record<string, unknown>
  const shopId = String(body.shopId ?? '')
  const bookingId = String(body.bookingId ?? '')
  if (!shopId || !bookingId) {
    return res.status(400).json({ error: 'Missing shopId or bookingId' })
  }

  try {
    const result = await sendBookingNotifications({
      shopId,
      bookingId,
      shopSlug: String(body.shopSlug ?? ''),
      clientName: String(body.clientName ?? 'Guest'),
      clientEmail: body.clientEmail ? String(body.clientEmail) : undefined,
      clientPhone: body.clientPhone ? String(body.clientPhone) : undefined,
      serviceName: String(body.serviceName ?? 'Service'),
      durationMin: Number(body.durationMin) || 60,
      dateLabel: String(body.dateLabel ?? ''),
      time: String(body.time ?? ''),
      therapistLabel: String(body.therapistLabel ?? 'Assigned on arrival'),
      shopName: String(body.shopName ?? 'Shop'),
      shopAddress: body.shopAddress ? String(body.shopAddress) : undefined,
      shopPhone: body.shopPhone ? String(body.shopPhone) : undefined,
      shopEmail: body.shopEmail ? String(body.shopEmail) : undefined,
      ownerNotificationEmail: body.ownerNotificationEmail
        ? String(body.ownerNotificationEmail)
        : undefined,
      logoUrl: body.logoUrl ? String(body.logoUrl) : undefined,
      cancelUrl: String(body.cancelUrl ?? ''),
      totalPrice: body.totalPrice != null ? Number(body.totalPrice) : undefined,
      startIso: String(body.startIso ?? ''),
      depositPaid: body.depositPaid != null ? Number(body.depositPaid) : undefined,
      balanceDue: body.balanceDue != null ? Number(body.balanceDue) : undefined,
    })
    return res.status(200).json({ success: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Notifications failed'
    console.error('[api/booking-notifications]', message)
    return res.status(500).json({ error: message })
  }
}
