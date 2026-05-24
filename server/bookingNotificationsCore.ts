import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import twilio from 'twilio'
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
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  if (!url || !key) throw new Error('Supabase service role not configured')
  return createClient(url, key)
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

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER

  if (sid && token && from && input.clientPhone) {
    try {
      const client = twilio(sid, token)
      await client.messages.create({
        body: `Hi ${input.clientName.split(' ')[0]}, your booking at ${input.shopName} is confirmed: ${input.serviceName} on ${input.dateLabel} at ${input.time}. Ref: ${ref}. To cancel call ${input.shopPhone || input.shopName}. Reply STOP to opt out.`,
        from,
        to: formatAuSmsTo(input.clientPhone),
      })
      result.sms = true
    } catch (e) {
      console.error('[booking-notifications] client sms', e)
    }
  }

  if (sid && token && from && input.shopPhone) {
    try {
      const client = twilio(sid, token)
      await client.messages.create({
        body: `New booking: ${input.clientName} - ${input.serviceName} on ${input.dateLabel} at ${input.time}. Ref ${ref}`,
        from,
        to: formatAuSmsTo(input.shopPhone),
      })
      result.ownerSms = true
    } catch (e) {
      console.error('[booking-notifications] owner sms', e)
    }
  }

  return result
}

export async function sendBookingReminderSms(opts: {
  clientPhone: string
  clientName: string
  serviceName: string
  dateLabel: string
  time: string
  shopName: string
  shopPhone?: string
}): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) return false

  const first = opts.clientName.split(' ')[0]
  const cancelPhone = opts.shopPhone?.trim() || opts.shopName

  try {
    const client = twilio(sid, token)
    await client.messages.create({
      body: `Hi ${first}, reminder: ${opts.serviceName} tomorrow at ${opts.time} at ${opts.shopName}. Cancel: ${cancelPhone}. Reply STOP to unsubscribe.`,
      from,
      to: formatAuSmsTo(opts.clientPhone),
    })
    return true
  } catch (e) {
    console.error('[booking-reminder] sms', e)
    return false
  }
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
