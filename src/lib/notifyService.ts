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
  pdfBase64: string
): Promise<boolean> {
  if (!tx.clientEmail) return false

  const res = await fetch('/api/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: tx.clientEmail,
      subject: `Your receipt from ${shopName}`,
      shopName,
      transaction: tx,
      pdfBase64,
    }),
  })
  return res.ok
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
