import type { VercelRequest, VercelResponse } from '@vercel/node'
import { POST_bookingConfirmationEmail } from '../server/bookingConfirmationEmailHandler'
import { POST_ownerBookingNotificationEmail } from '../server/bookingOwnerNotificationEmailHandler'
import { POST_email } from '../server/emailHandler'
import { POST_giftVoucherEmail } from '../server/giftVoucherEmailHandler'

type EmailKind =
  | 'receipt'
  | 'health_fund'
  | 'owner_booking'
  | 'booking_confirmation'
  | 'gift_voucher'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const kind = (req.body as { emailKind?: EmailKind })?.emailKind ?? 'receipt'

  switch (kind) {
    case 'owner_booking':
      return POST_ownerBookingNotificationEmail(req, res)
    case 'booking_confirmation':
      return POST_bookingConfirmationEmail(req, res)
    case 'gift_voucher':
      return POST_giftVoucherEmail(req, res)
    case 'receipt':
    case 'health_fund':
    default:
      return POST_email(req, res)
  }
}
