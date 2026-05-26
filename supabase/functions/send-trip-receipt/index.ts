import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'
import webpush from 'npm:web-push@3.6.7'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
const RESEND_FROM_EMAIL = Deno.env.get('RESEND_FROM_EMAIL') ?? 'receipts@trip2talk.com.au'
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

interface ReceiptPayload {
  client_name: string
  client_email: string
  client_phone?: string
  trip_code: string
  amount_aud: number
  reference_number: string
  payment_method: string
  booking_status?: string
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function buildFbGroupPost(p: ReceiptPayload, amountFormatted: string): string {
  const status = p.booking_status?.replace(/_/g, ' ') ?? 'PAID'
  return [
    '✅ รับชำระเงินแล้ว / Payment received',
    '',
    `🧳 ทัวร์: ${p.trip_code}`,
    `👤 ลูกทริป: ${p.client_name}`,
    `💰 จำนวน: ${amountFormatted}`,
    `💳 ช่องทาง: ${p.payment_method}`,
    `📋 สถานะ: ${status}`,
    `🔖 Ref: ${p.reference_number}`,
    '',
    '— Trip2Talk',
  ].join('\n')
}

async function notifyStaffWebPush(
  payload: ReceiptPayload,
  amountFormatted: string
): Promise<{ sent: number; failed: number; skipped?: string }> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return { sent: 0, failed: 0, skipped: 'VAPID not configured' }
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return { sent: 0, failed: 0, skipped: 'Supabase service role missing' }
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: subs, error } = await admin.from('push_notifications').select('*')
  if (error) throw error
  if (!subs?.length) return { sent: 0, failed: 0, skipped: 'No push subscriptions' }

  webpush.setVapidDetails(
    'mailto:receipts@trip2talk.com.au',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  )

  const pushBody = JSON.stringify({
    title: '💳 Payment received',
    body: `${payload.client_name} · ${amountFormatted} · ${payload.trip_code}`,
    url: '/staff',
    reference_number: payload.reference_number,
    fb_text: buildFbGroupPost(payload, amountFormatted),
  })

  let sent = 0
  let failed = 0

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        pushBody
      )
      sent += 1
    } catch (err: unknown) {
      failed += 1
      const status = (err as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) {
        await admin.from('push_notifications').delete().eq('endpoint', sub.endpoint)
      }
      console.warn('[send-trip-receipt-v2] push failed:', sub.endpoint, err)
    }
  }

  return { sent, failed }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const payload: ReceiptPayload = await req.json()
    const results = {
      email: false,
      staff_push: { sent: 0, failed: 0 } as { sent: number; failed: number; skipped?: string },
      errors: [] as string[],
    }

    const amountFormatted = new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
    }).format(payload.amount_aud ?? 0)

    const gstAmount = ((payload.amount_aud ?? 0) / 11).toFixed(2)
    const fromHeader = RESEND_FROM_EMAIL.includes('<')
      ? RESEND_FROM_EMAIL
      : `Trip2Talk <${RESEND_FROM_EMAIL}>`

    if (RESEND_API_KEY && payload.client_email?.trim()) {
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:20px;">
          <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
            <div style="background:#0a0a0a;padding:32px;text-align:center;">
              <h1 style="color:#fbbf24;margin:0;letter-spacing:4px;">TRIP2TALK</h1>
            </div>
            <div style="padding:32px;">
              <p>Dear <strong>${payload.client_name}</strong>,</p>
              <p>Thank you — your payment has been received.</p>
              <p style="font-size:28px;font-weight:700;color:#fbbf24;">${amountFormatted}</p>
              <p style="font-size:12px;color:#6b7280;">Includes GST: $${gstAmount} AUD</p>
              <p><strong>Ref:</strong> ${payload.reference_number}</p>
              <p><strong>Tour:</strong> ${payload.trip_code}</p>
              <p><strong>Method:</strong> ${payload.payment_method}</p>
            </div>
          </div>
        </body>
        </html>
      `

      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromHeader,
          to: [payload.client_email.trim()],
          subject: `Payment Receipt — ${payload.trip_code} — ${amountFormatted}`,
          html: emailHtml,
        }),
      })

      if (emailRes.ok) {
        results.email = true
      } else {
        results.errors.push(`Email failed: ${await emailRes.text()}`)
      }
    } else if (!payload.client_email?.trim()) {
      results.errors.push('No client email — receipt not sent')
    }

    try {
      results.staff_push = await notifyStaffWebPush(payload, amountFormatted)
    } catch (pushErr) {
      const msg = pushErr instanceof Error ? pushErr.message : String(pushErr)
      results.errors.push(`Staff push: ${msg}`)
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
