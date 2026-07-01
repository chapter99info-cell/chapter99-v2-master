import { getServiceSupabase } from './supabaseServer'
import { Resend } from 'resend'
import { RECEIPTS_FROM } from './emailConstants'
import {
  buildBookingConfirmationHTML,
  buildBookingConfirmationSubject,
  buildBookingConfirmationText,
  type BookingConfirmationEmailPayload,
} from './bookingConfirmationEmailTemplate'
import {
  buildOwnerBookingNotificationHTML,
  buildOwnerBookingNotificationSubject,
  buildOwnerBookingNotificationText,
  type OwnerBookingNotificationPayload,
} from './bookingOwnerNotificationEmailTemplate'

function supabaseAdmin() {
  return getServiceSupabase()
}

function formatAuSmsTo(to: string): string {
  const digits = to.replace(/\D/g, '')
  if (to.startsWith('+')) return to
  if (digits.startsWith('61')) return `+${digits}`
  if (digits.startsWith('0')) return `+61${digits.slice(1)}`
  return `+61${digits}`
}

export interface BookingNotificationsInput {
  shopId: string
  bookingId: string
  shopSlug: string
  clientName: string
  clientEmail?: string
  clientPhone?: string
  serviceName: string
  durationMin: number
  dateLabel: string
  time: string
  therapistLabel: string
  shopName: string
  shopAddress?: string
  shopPhone?: string
  shopEmail?: string
  ownerNotificationEmail?: string
  logoUrl?: string
  cancelUrl: string
  totalPrice?: number
  startIso: string
  depositPaid?: number
  balanceDue?: number
}

export async function sendBookingNotifications(
  input: BookingNotificationsInput
): Promise<{ email: boolean; sms: boolean; ownerEmail: boolean; ownerSms: boolean }> {
  const ref = `BK-${input.bookingId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
  const result = { email: false, sms: false, ownerEmail: false, ownerSms: false }

  const { sendShopSms } = await import('./smsGateway')

  const emailPayload: BookingConfirmationEmailPayload = {
    to: input.clientEmail?.trim() ?? '',
    clientName: input.clientName,
    serviceName: input.serviceName,
    durationMin: input.durationMin,
    date: input.dateLabel,
    time: input.time,
    therapistLabel: input.therapistLabel,
    shopName: input.shopName,
    shopAddress: input.shopAddress,
    shopPhone: input.shopPhone,
    shopEmail: input.shopEmail,
    logoUrl: input.logoUrl,
    bookingRef: ref,
    cancelUrl: input.cancelUrl,
    totalPrice: input.totalPrice,
    depositPaid: input.depositPaid,
    balanceDue: input.balanceDue,
  }

  if (process.env.RESEND_API_KEY && emailPayload.to) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const r = await resend.emails.send({
        from: RECEIPTS_FROM,
        to: emailPayload.to,
        subject: buildBookingConfirmationSubject(input.shopName),
        html: buildBookingConfirmationHTML(emailPayload),
        text: buildBookingConfirmationText(emailPayload),
      })
      result.email = !r.error
    } catch (e) {
      console.error('[booking-notifications] client email', e)
    }
  }

  const ownerPayload: OwnerBookingNotificationPayload = {
    to: input.ownerNotificationEmail?.trim() ?? '',
    clientName: input.clientName,
    clientPhone: input.clientPhone,
    clientEmail: input.clientEmail,
    serviceName: input.serviceName,
    durationMin: input.durationMin,
    date: input.dateLabel,
    time: input.time,
    therapistLabel: input.therapistLabel,
    shopName: input.shopName,
    source: 'online',
    bookingId: ref,
  }

  if (process.env.RESEND_API_KEY && ownerPayload.to) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      const r = await resend.emails.send({
        from: RECEIPTS_FROM,
        to: ownerPayload.to,
        subject: buildOwnerBookingNotificationSubject(input.shopName, input.clientName),
        html: buildOwnerBookingNotificationHTML(ownerPayload),
        text: buildOwnerBookingNotificationText(ownerPayload),
      })
      result.ownerEmail = !r.error
    } catch (e) {
      console.error('[booking-notifications] owner email', e)
    }
  }

  if (input.clientPhone) {
    const smsResult = await sendShopSms({
      shopId: input.shopId,
      to: input.clientPhone,
      priority: 'critical',
      message: `Hi ${input.clientName.split(' ')[0]}, your booking at ${input.shopName} is confirmed: ${input.serviceName} on ${input.dateLabel} at ${input.time}. Ref: ${ref}. To cancel call ${input.shopPhone || input.shopName}. Reply STOP to opt out.`,
    })
    result.sms = smsResult.sent
  }

  if (input.shopPhone) {
    const ownerSms = await sendShopSms({
      shopId: input.shopId,
      to: input.shopPhone,
      priority: 'critical',
      message: `New booking: ${input.clientName} - ${input.serviceName} on ${input.dateLabel} at ${input.time}. Ref ${ref}`,
    })
    result.ownerSms = ownerSms.sent
  }

  return result
}

export async function sendBookingReminderSms(opts: {
  shopId: string
  clientPhone: string
  clientName: string
  serviceName: string
  dateLabel: string
  time: string
  shopName: string
  shopPhone?: string
}): Promise<boolean> {
  const { sendShopSms } = await import('./smsGateway')
  const first = opts.clientName.split(' ')[0]
  const cancelPhone = opts.shopPhone?.trim() || opts.shopName

  const result = await sendShopSms({
    shopId: opts.shopId,
    to: opts.clientPhone,
    priority: 'critical',
    message: `Hi ${first}, reminder: ${opts.serviceName} tomorrow at ${opts.time} at ${opts.shopName}. Cancel: ${cancelPhone}. Reply STOP to unsubscribe.`,
  })
  return result.sent
}

export async function markReminderSent(bookingId: string): Promise<void> {
  const sb = supabaseAdmin()
  await sb
    .from('bookings')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('id', bookingId)
}

export async function cancelBookingById(
  bookingId: string,
  shopSlug: string
): Promise<{ ok: boolean; error?: string; shopId?: string }> {
  const sb = supabaseAdmin()
  const { data: shop } = await sb
    .from('shops')
    .select('id')
    .eq('slug', shopSlug.trim().toLowerCase())
    .eq('active', true)
    .maybeSingle()

  if (!shop?.id) return { ok: false, error: 'Shop not found' }

  const { data: booking } = await sb
    .from('bookings')
    .select('id, shop_id, status, start_time')
    .eq('id', bookingId)
    .maybeSingle()

  if (!booking || booking.shop_id !== shop.id) {
    return { ok: false, error: 'Booking not found' }
  }
  if (booking.status === 'cancelled') {
    return { ok: true, shopId: shop.id }
  }

  const { error } = await sb
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (error) return { ok: false, error: error.message }
  return { ok: true, shopId: shop.id }
}
