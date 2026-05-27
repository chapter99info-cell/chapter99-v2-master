import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabase } from './supabaseServer'
import type Stripe from 'stripe'
import { sendBookingNotifications } from './bookingNotificationsCore'

function buildCancelUrl(origin: string, shopSlug: string, bookingId: string): string {
  const params = new URLSearchParams({ booking: bookingId, shop: shopSlug })
  return `${origin}/cancel?${params.toString()}`
}

export type DepositType = 'percent' | 'fixed'

export interface ShopDepositRow {
  id: string
  slug: string | null
  name: string
  addon_stripe: boolean | null
  stripe_pub_key: string | null
  deposit_enabled: boolean | null
  deposit_type: string | null
  deposit_percent: number | null
  deposit_fixed_amount: number | null
  deposit_refund_hours: number | null
  address: string | null
  phone: string | null
  email: string | null
  notification_email: string | null
  logo_url: string | null
}

export function supabaseAdmin(): SupabaseClient {
  return getServiceSupabase()
}

export function isStripeEnabledForShop(shop: ShopDepositRow): boolean {
  return shop.addon_stripe === true && Boolean(shop.stripe_pub_key?.trim())
}

export function shopRequiresDeposit(shop: ShopDepositRow): boolean {
  return shop.deposit_enabled === true && isStripeEnabledForShop(shop)
}

export function calculateDepositFromShop(
  servicePrice: number,
  shop: ShopDepositRow
): number {
  if (!shop.deposit_enabled || servicePrice <= 0) return 0

  const type = shop.deposit_type === 'fixed' ? 'fixed' : 'percent'
  const percent = shop.deposit_percent ?? 20
  const fixed = Number(shop.deposit_fixed_amount ?? 20)

  let amount =
    type === 'fixed'
      ? fixed
      : Math.round(((servicePrice * percent) / 100) * 100) / 100

  amount = Math.min(amount, servicePrice)
  amount = Math.max(0.5, amount)
  return Math.round(amount * 100) / 100
}

export async function createBookingDepositCheckout(opts: {
  stripe: Stripe
  bookingId: string
  shopId: string
  shopSlug: string
  origin: string
  clientEmail: string
}): Promise<{ url: string; sessionId: string; depositAmount: number }> {
  const sb = supabaseAdmin()

  const { data: booking, error: bookErr } = await sb
    .from('bookings')
    .select(
      `
      id, shop_id, status, deposit_paid, deposit_amount,
      clients ( name, email, phone ),
      services ( name_en, price )
    `
    )
    .eq('id', opts.bookingId)
    .eq('shop_id', opts.shopId)
    .maybeSingle()

  if (bookErr || !booking) throw new Error('Booking not found')

  if (booking.deposit_paid) throw new Error('Deposit already paid')
  if (booking.status !== 'pending_deposit') {
    throw new Error('Booking is not awaiting deposit')
  }

  const { data: shop, error: shopErr } = await sb
    .from('shops')
    .select(
      'id, slug, name, addon_stripe, stripe_pub_key, deposit_enabled, deposit_type, deposit_percent, deposit_fixed_amount'
    )
    .eq('id', opts.shopId)
    .maybeSingle()

  if (shopErr || !shop) throw new Error('Shop not found')
  if (!shopRequiresDeposit(shop as ShopDepositRow)) {
    throw new Error('Deposits are not enabled for this shop')
  }

  const svc = booking.services as { name_en?: string; price?: number } | null
  const servicePrice = Number(svc?.price ?? 0)
  const depositAmount =
    booking.deposit_amount != null
      ? Number(booking.deposit_amount)
      : calculateDepositFromShop(servicePrice, shop as ShopDepositRow)

  if (depositAmount < 0.5) throw new Error('Invalid deposit amount')

  const amountCents = Math.round(depositAmount * 100)
  const serviceName = svc?.name_en ?? 'Appointment'
  const shopQuery = `&shop=${encodeURIComponent(opts.shopSlug)}`

  const session = await opts.stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: opts.clientEmail.trim(),
    line_items: [
      {
        price_data: {
          currency: 'aud',
          unit_amount: amountCents,
          product_data: {
            name: `Booking deposit — ${shop.name}`,
            description: serviceName,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      purpose: 'booking_deposit',
      booking_id: opts.bookingId,
      shop_id: opts.shopId,
      shop_slug: opts.shopSlug,
      deposit_aud: String(depositAmount),
    },
    success_url: `${opts.origin}/book?deposit_success=1&session_id={CHECKOUT_SESSION_ID}${shopQuery}`,
    cancel_url: `${opts.origin}/book?deposit_cancelled=1&booking=${opts.bookingId}${shopQuery}`,
  })

  if (!session.url) throw new Error('Stripe did not return a checkout URL')

  await sb
    .from('bookings')
    .update({
      deposit_amount: depositAmount,
      deposit_stripe_session_id: session.id,
    })
    .eq('id', opts.bookingId)

  return { url: session.url, sessionId: session.id, depositAmount }
}

export async function completeBookingDepositSession(
  session: Stripe.Checkout.Session,
  origin: string
): Promise<{
  bookingId: string
  alreadyDone: boolean
  clientName: string
  serviceName: string
  dateLabel: string
  time: string
  depositAmount: number
  totalPrice: number
  therapistLabel: string
}> {
  if (session.payment_status !== 'paid') {
    throw new Error('Payment not completed')
  }

  const meta = session.metadata ?? {}
  if (meta.purpose !== 'booking_deposit' || !meta.booking_id || !meta.shop_id) {
    throw new Error('Invalid session metadata')
  }

  const bookingId = meta.booking_id
  const shopId = meta.shop_id
  const sb = supabaseAdmin()

  const { data: existing } = await sb
    .from('bookings')
    .select('id, deposit_paid, status')
    .eq('id', bookingId)
    .maybeSingle()

  if (!existing) throw new Error('Booking not found')
  if (existing.deposit_paid) {
    const { data: row } = await sb
      .from('bookings')
      .select(
        `
        start_time, therapist_name, deposit_amount,
        clients ( name ),
        services ( name_en, price )
      `
      )
      .eq('id', bookingId)
      .single()
    const c = row?.clients as { name?: string } | null
    const s = row?.services as { name_en?: string; price?: number } | null
    const st = row?.start_time ? new Date(row.start_time as string) : new Date()
    return {
      bookingId,
      alreadyDone: true,
      clientName: c?.name ?? 'Guest',
      serviceName: s?.name_en ?? 'Service',
      dateLabel: st.toLocaleDateString('en-AU', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'Australia/Sydney',
      }),
      time: st.toLocaleTimeString('en-AU', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'Australia/Sydney',
      }),
      depositAmount: Number(row?.deposit_amount ?? 0),
      totalPrice: Number(s?.price ?? 0),
      therapistLabel: (row?.therapist_name as string) || 'Assigned on arrival',
    }
  }

  const depositAmount = parseFloat(meta.deposit_aud || '0')
  const paymentIntent =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id

  const { data: booking, error: updErr } = await sb
    .from('bookings')
    .update({
      deposit_paid: true,
      deposit_paid_at: new Date().toISOString(),
      deposit_amount: depositAmount || undefined,
      deposit_stripe_session_id: session.id,
      deposit_stripe_payment_intent: paymentIntent ?? null,
      status: 'deposit_paid',
    })
    .eq('id', bookingId)
    .select(
      `
      id, start_time, therapist_name,
      clients ( name, email, phone ),
      services ( name_en, duration, price )
    `
    )
    .single()

  if (updErr || !booking) throw new Error(updErr?.message ?? 'Could not update booking')

  const { data: shop } = await sb
    .from('shops')
    .select(
      'id, slug, name, address, phone, email, notification_email, logo_url, deposit_refund_hours'
    )
    .eq('id', shopId)
    .single()

  const client = booking.clients as { name?: string; email?: string; phone?: string } | null
  const svc = booking.services as { name_en?: string; duration?: number; price?: number } | null
  const start = new Date(booking.start_time as string)
  const dateLabel = start.toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'Australia/Sydney',
  })
  const time = start.toLocaleTimeString('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Australia/Sydney',
  })

  const shopSlug = (shop?.slug as string) || meta.shop_slug || ''
  const cancelUrl = shopSlug ? buildCancelUrl(origin, shopSlug, bookingId) : ''

  const ownerEmail =
    (shop?.notification_email as string)?.trim() ||
    (shop?.email as string)?.trim() ||
    ''

  const totalPrice = Number(svc?.price ?? 0)
  const paidDeposit = depositAmount || Number(meta.deposit_aud || 0)

  const notifyPayload = {
    type: 'booking',
    clientName: client?.name ?? 'Guest',
    serviceName: svc?.name_en ?? 'Service',
    appointmentAt: booking.start_time,
    therapist: (booking.therapist_name as string) || null,
    source: 'online',
    bookedAt: new Date().toISOString(),
  }
  await sb.from('notifications').insert({
    shop_id: shopId,
    booking_id: bookingId,
    message: JSON.stringify(notifyPayload),
    is_read: false,
  })

  await sendBookingNotifications({
    shopId,
    bookingId,
    shopSlug,
    clientName: client?.name ?? 'Guest',
    clientEmail: client?.email ?? undefined,
    clientPhone: client?.phone ?? undefined,
    serviceName: svc?.name_en ?? 'Service',
    durationMin: Number(svc?.duration) || 60,
    dateLabel,
    time,
    therapistLabel:
      (booking.therapist_name as string)?.trim() || 'Assigned on arrival',
    shopName: (shop?.name as string) || 'Shop',
    shopAddress: shop?.address as string | undefined,
    shopPhone: shop?.phone as string | undefined,
    shopEmail: shop?.email as string | undefined,
    ownerNotificationEmail: ownerEmail,
    logoUrl: shop?.logo_url as string | undefined,
    cancelUrl,
    totalPrice,
    startIso: start.toISOString(),
    depositPaid: paidDeposit,
    balanceDue: Math.max(0, totalPrice - paidDeposit),
  })

  return {
    bookingId,
    alreadyDone: false,
    clientName: client?.name ?? 'Guest',
    serviceName: svc?.name_en ?? 'Service',
    dateLabel,
    time,
    depositAmount: paidDeposit,
    totalPrice,
    therapistLabel:
      (booking.therapist_name as string)?.trim() || 'Assigned on arrival',
  }
}

export async function refundBookingDepositIfEligible(
  bookingId: string,
  shopId: string
): Promise<{ refunded: boolean; reason?: string }> {
  const sb = supabaseAdmin()

  const { data: booking } = await sb
    .from('bookings')
    .select(
      'id, start_time, deposit_paid, deposit_refunded, deposit_stripe_payment_intent, deposit_amount'
    )
    .eq('id', bookingId)
    .eq('shop_id', shopId)
    .maybeSingle()

  if (!booking?.deposit_paid || booking.deposit_refunded) {
    return { refunded: false, reason: 'No deposit to refund' }
  }

  const { data: shop } = await sb
    .from('shops')
    .select('deposit_refund_hours')
    .eq('id', shopId)
    .maybeSingle()

  const refundHours = shop?.deposit_refund_hours ?? 24
  const start = new Date(booking.start_time as string)
  const cutoff = new Date(start.getTime() - refundHours * 60 * 60 * 1000)
  if (new Date() > cutoff) {
    return { refunded: false, reason: 'Outside refund window' }
  }

  const pi = booking.deposit_stripe_payment_intent as string | null
  if (!pi) return { refunded: false, reason: 'No payment intent' }

  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) return { refunded: false, reason: 'Stripe not configured' }

  const Stripe = (await import('stripe')).default
  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' })

  try {
    await stripe.refunds.create({ payment_intent: pi })
    await sb
      .from('bookings')
      .update({
        deposit_refunded: true,
        deposit_refunded_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
    return { refunded: true }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Refund failed'
    return { refunded: false, reason: msg }
  }
}
