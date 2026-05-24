// Chapter99 V4 — Phase 5
// Notification Service: SMS (Twilio) + Email (Resend)
// Called from Vercel Edge Functions — not directly from browser

// ── Vercel Edge Function: /api/notify.ts ──────────────────────

import type { Transaction } from '../types/pos'

interface NotifyPayload {
  type: 'receipt' | 'health_fund' | 'booking_confirm' | 'reminder'
  transaction?: Transaction
  clientPhone?: string
  clientEmail?: string
  shopName: string
  pdfUrl?: string
}

// Send SMS via Twilio
export async function sendSMS(
  to: string,
  message: string
): Promise<boolean> {
  const res = await fetch('/api/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, message }),
  })
  return res.ok
}

// Send Email with PDF via Resend
export async function sendReceiptEmail(
  tx: Transaction,
  shopName: string,
  pdfBase64: string,
  toOverride?: string
): Promise<boolean> {
  const to = (toOverride ?? tx.clientEmail)?.trim()
  if (!to) {
    console.warn('[receipt-email] skipped: no client email on transaction', tx.id)
    return false
  }

  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject: `Your receipt from ${shopName}`,
        shopName,
        transaction: tx,
        pdfBase64,
        emailKind: 'receipt',
      }),
    })

    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean
      id?: string
      error?: string
    }

    if (res.ok && body.success) {
      console.info('[receipt-email] sent', { to, transactionId: tx.id, resendId: body.id })
      return true
    }

    console.error('[receipt-email] failed', {
      to,
      transactionId: tx.id,
      status: res.status,
      error: body.error ?? res.statusText,
    })
    return false
  } catch (err) {
    console.error('[receipt-email] network error', {
      to,
      transactionId: tx.id,
      message: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

export async function sendHealthFundEmail(
  tx: Transaction,
  shopName: string,
  pdfBase64: string,
  toOverride?: string
): Promise<boolean> {
  const to = (toOverride ?? tx.clientEmail)?.trim()
  if (!to) {
    console.warn('[health-fund-email] skipped: no client email', tx.id)
    return false
  }

  try {
    const res = await fetch('/api/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to,
        subject: `Health Fund Receipt - ${shopName} ${tx.id}`,
        shopName,
        transaction: { ...tx, healthFundIssued: true },
        pdfBase64,
        emailKind: 'health_fund',
      }),
    })

    const body = (await res.json().catch(() => ({}))) as {
      success?: boolean
      id?: string
      error?: string
    }

    if (res.ok && body.success) {
      console.info('[health-fund-email] sent', { to, transactionId: tx.id, resendId: body.id })
      return true
    }

    console.error('[health-fund-email] failed', {
      to,
      transactionId: tx.id,
      status: res.status,
      error: body.error ?? res.statusText,
    })
    return false
  } catch (err) {
    console.error('[health-fund-email] network error', {
      to,
      transactionId: tx.id,
      message: err instanceof Error ? err.message : String(err),
    })
    return false
  }
}

export interface OwnerBookingNotificationRequest {
  to: string
  clientName: string
  clientPhone?: string
  clientEmail?: string
  serviceName: string
  durationMin: number
  date: string
  time: string
  therapistLabel?: string
  shopName: string
  source?: string
  bookingId?: string
}

/** Notify shop owner when a new booking is confirmed. */
export async function sendOwnerBookingNotificationEmail(
  payload: OwnerBookingNotificationRequest
): Promise<{ ok: boolean; error?: string }> {
  if (!payload.to?.trim()) {
    return { ok: false, error: 'No notification email configured' }
  }

  try {
    const res = await fetch('/api/booking-owner-notification-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Owner notification email could not be sent' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Email service unavailable' }
  }
}

export interface BookingNotificationsRequest {
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

/** Public online booking: confirmation email + SMS + owner alerts. */
export async function sendBookingNotifications(
  payload: BookingNotificationsRequest
): Promise<{ ok: boolean }> {
  try {
    const res = await fetch('/api/booking-notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return { ok: res.ok }
  } catch {
    return { ok: false }
  }
}

export interface BookingConfirmationEmailRequest {
  to: string
  clientName: string
  serviceName: string
  durationMin: number
  date: string
  time: string
  therapistLabel: string
  shopName: string
  shopAddress?: string
  shopPhone?: string
  bookingRef?: string
  cancelUrl?: string
  logoUrl?: string
  totalPrice?: number
  shopEmail?: string
}

/** Send booking confirmation email after staff wizard confirms a booking. */
export async function sendBookingConfirmationEmail(
  payload: BookingConfirmationEmailRequest
): Promise<{ ok: boolean; error?: string }> {
  if (!payload.to?.trim()) {
    return { ok: false, error: 'No email address' }
  }

  try {
    const res = await fetch('/api/booking-confirmation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Confirmation email could not be sent' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Email service unavailable' }
  }
}

export interface GiftVoucherEmailRequest {
  to: string
  buyerName: string
  voucherCode: string
  amount: number
  expiryDate: string
  shopName: string
  shopAddress: string
  shopPhone: string
  shopEmail?: string
  logoUrl?: string
}

/** Send gift voucher email via Resend (only when buyer email is provided). */
export async function sendGiftVoucherEmail(
  payload: GiftVoucherEmailRequest
): Promise<{ ok: boolean; error?: string }> {
  if (!payload.to?.trim()) {
    return { ok: false, error: 'No email address' }
  }

  try {
    const res = await fetch('/api/gift-voucher-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    if (!res.ok) {
      return { ok: false, error: data.error ?? 'Email could not be sent' }
    }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Email service unavailable' }
  }
}

// SMS Templates
export const SMS = {
  receiptConfirm: (shopName: string, total: string) =>
    `Thanks for visiting ${shopName}! Your receipt of ${total} has been sent to your email. Hope to see you again soon! 💆`,

  healthFundReady: (shopName: string) =>
    `Your Health Fund receipt from ${shopName} is ready. Check your email to download and claim. ⭐`,

  googleReview: (shopName: string, link: string) =>
    `Hi! We hope you enjoyed your treatment at ${shopName}. We'd love your feedback: ${link} 🌟`,

  bookingReminder: (shopName: string, time: string, address: string) =>
    `Reminder: Your massage at ${shopName} is at ${time} today! 📍 ${address}`,
}
