/**
 * Daily closing report — revenue, payments, GST, bookings, week-over-week compare.
 */
import { Resend } from 'resend'
import { getServiceSupabase } from './supabaseServer'
import { sendShopSms } from './smsGateway'
import { RECEIPTS_FROM } from './emailConstants'

export interface DailyReportStats {
  dateLabel: string
  dateYmd: string
  totalRevenue: number
  gstCollected: number
  surchargeCollected: number
  paymentBreakdown: { cash: number; card: number; payid: number; hicaps: number; other: number }
  totalBookings: number
  completedSessions: number
  noShows: number
  lastWeekRevenue: number
  revenueChangePct: number | null
}

interface TxPayment {
  total?: number
  gst?: number
  surcharge?: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function sydneyYmd(date = new Date()): string {
  return date.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function dayBoundsUtc(ymd: string): { start: string; end: string } {
  return {
    start: `${ymd}T00:00:00+10:00`,
    end: `${ymd}T23:59:59.999+10:00`,
  }
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null
  return Math.round(((current - previous) / previous) * 1000) / 10
}

function formatAudShort(amount: number): string {
  return `$${amount.toFixed(0)}`
}

export function buildDailyReportSms(stats: DailyReportStats): string {
  const vs =
    stats.revenueChangePct === null
      ? 'n/a'
      : `${stats.revenueChangePct >= 0 ? '+' : ''}${stats.revenueChangePct}%`
  const msg =
    `Chapter99 Report ${stats.dateLabel}: ${formatAudShort(stats.totalRevenue)} revenue, ` +
    `${stats.completedSessions} sessions. Cash ${formatAudShort(stats.paymentBreakdown.cash)} ` +
    `Card ${formatAudShort(stats.paymentBreakdown.card)} ` +
    `HICAPS ${formatAudShort(stats.paymentBreakdown.hicaps)}. vs last week: ${vs}`
  return msg.length <= 160 ? msg : msg.slice(0, 157) + '...'
}

export function buildDailyReportHtml(shopName: string, stats: DailyReportStats): string {
  const vs =
    stats.revenueChangePct === null
      ? 'No comparison data'
      : `${stats.revenueChangePct >= 0 ? '+' : ''}${stats.revenueChangePct}% vs same day last week`

  return `<!DOCTYPE html><html><body style="font-family:Georgia,serif;color:#1A1A1A;max-width:600px;margin:0 auto;padding:24px">
<h1 style="color:#2D5016;font-size:22px">Daily Closing Report — ${shopName}</h1>
<p style="color:#6B7280">${stats.dateLabel}</p>
<table style="width:100%;border-collapse:collapse;margin:16px 0">
<tr><td style="padding:8px 0;border-bottom:1px solid #E5E7EB"><strong>Total revenue</strong></td>
<td style="text-align:right;padding:8px 0;border-bottom:1px solid #E5E7EB">$${stats.totalRevenue.toFixed(2)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #E5E7EB">GST collected</td>
<td style="text-align:right;padding:8px 0;border-bottom:1px solid #E5E7EB">$${stats.gstCollected.toFixed(2)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #E5E7EB">Surcharge collected</td>
<td style="text-align:right;padding:8px 0;border-bottom:1px solid #E5E7EB">$${stats.surchargeCollected.toFixed(2)}</td></tr>
<tr><td style="padding:8px 0;border-bottom:1px solid #E5E7EB">Week-over-week</td>
<td style="text-align:right;padding:8px 0;border-bottom:1px solid #E5E7EB">${vs}</td></tr>
</table>
<h2 style="color:#2D5016;font-size:16px">Payment breakdown</h2>
<ul style="line-height:1.8">
<li>Cash: $${stats.paymentBreakdown.cash.toFixed(2)}</li>
<li>Card: $${stats.paymentBreakdown.card.toFixed(2)}</li>
<li>PayID: $${stats.paymentBreakdown.payid.toFixed(2)}</li>
<li>HICAPS: $${stats.paymentBreakdown.hicaps.toFixed(2)}</li>
<li>Other: $${stats.paymentBreakdown.other.toFixed(2)}</li>
</ul>
<h2 style="color:#2D5016;font-size:16px">Bookings</h2>
<ul style="line-height:1.8">
<li>Total bookings: ${stats.totalBookings}</li>
<li>Completed sessions: ${stats.completedSessions}</li>
<li>No-shows: ${stats.noShows}</li>
</ul>
<p style="color:#6B7280;font-size:12px;margin-top:32px">Chapter99 Solutions — mirathaimassage.com.au</p>
</body></html>`
}

export async function calculateDailyReport(
  shopId: string,
  reportYmd?: string
): Promise<DailyReportStats> {
  const sb = getServiceSupabase()
  const ymd = reportYmd ?? sydneyYmd()
  const lastWeekYmd = addDaysYmd(ymd, -7)
  const { start, end } = dayBoundsUtc(ymd)
  const lastWeekBounds = dayBoundsUtc(lastWeekYmd)

  const dateLabel = new Date(`${ymd}T12:00:00+10:00`).toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  const [txRes, bookingsRes, lastWeekTxRes] = await Promise.all([
    sb
      .from('transactions')
      .select('payment, payment_method, payment_splits')
      .eq('shop_id', shopId)
      .eq('status', 'paid')
      .gte('paid_at', start)
      .lte('paid_at', end),
    sb
      .from('bookings')
      .select('id, status')
      .eq('shop_id', shopId)
      .gte('start_time', start)
      .lte('start_time', end),
    sb
      .from('transactions')
      .select('payment')
      .eq('shop_id', shopId)
      .eq('status', 'paid')
      .gte('paid_at', lastWeekBounds.start)
      .lte('paid_at', lastWeekBounds.end),
  ])

  const breakdown = { cash: 0, card: 0, payid: 0, hicaps: 0, other: 0 }
  let totalRevenue = 0
  let gstCollected = 0
  let surchargeCollected = 0

  for (const tx of txRes.data ?? []) {
    const payment = (tx.payment ?? {}) as TxPayment
    const total = Number(payment.total) || 0
    totalRevenue = round2(totalRevenue + total)
    gstCollected = round2(gstCollected + (Number(payment.gst) || 0))
    surchargeCollected = round2(surchargeCollected + (Number(payment.surcharge) || 0))

    const method = String(tx.payment_method ?? '').toLowerCase()
    const splits = tx.payment_splits as { method: string; amount: number }[] | null
    if (method === 'split' && splits?.length) {
      for (const s of splits) {
        const m = s.method.toLowerCase()
        const amt = Number(s.amount) || 0
        if (m === 'cash') breakdown.cash = round2(breakdown.cash + amt)
        else if (m === 'card' || m === 'amex') breakdown.card = round2(breakdown.card + amt)
        else if (m === 'payid') breakdown.payid = round2(breakdown.payid + amt)
        else if (m === 'hicaps') breakdown.hicaps = round2(breakdown.hicaps + amt)
        else breakdown.other = round2(breakdown.other + amt)
      }
    } else if (method === 'cash') breakdown.cash = round2(breakdown.cash + total)
    else if (method === 'card' || method === 'amex') breakdown.card = round2(breakdown.card + total)
    else if (method === 'payid') breakdown.payid = round2(breakdown.payid + total)
    else if (method === 'hicaps') breakdown.hicaps = round2(breakdown.hicaps + total)
    else breakdown.other = round2(breakdown.other + total)
  }

  let lastWeekRevenue = 0
  for (const tx of lastWeekTxRes.data ?? []) {
    const payment = (tx.payment ?? {}) as TxPayment
    lastWeekRevenue = round2(lastWeekRevenue + (Number(payment.total) || 0))
  }

  const bookings = bookingsRes.data ?? []
  const totalBookings = bookings.filter(b => b.status !== 'cancelled').length
  const completedSessions = bookings.filter(b => b.status === 'completed').length
  const noShows = bookings.filter(b => b.status === 'no_show').length

  return {
    dateLabel,
    dateYmd: ymd,
    totalRevenue,
    gstCollected,
    surchargeCollected,
    paymentBreakdown: breakdown,
    totalBookings,
    completedSessions,
    noShows,
    lastWeekRevenue,
    revenueChangePct: pctChange(totalRevenue, lastWeekRevenue),
  }
}

export function shopIsAtReportHour(
  timezone: string,
  reportHour: number,
  now = new Date()
): boolean {
  const hour = Number(
    new Intl.DateTimeFormat('en-AU', {
      timeZone: timezone || 'Australia/Sydney',
      hour: 'numeric',
      hour12: false,
    }).format(now)
  )
  return hour === reportHour
}

export async function sendDailyReportForShop(shop: {
  id: string
  name: string
  email?: string | null
  notification_email?: string | null
  phone?: string | null
  sms_enabled?: boolean | null
}): Promise<{ emailed: boolean; smsSent: boolean; error?: string }> {
  const stats = await calculateDailyReport(shop.id)
  const to =
    shop.notification_email?.trim() || shop.email?.trim() || ''
  let emailed = false

  if (to && process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY)
    const result = await resend.emails.send({
      from: RECEIPTS_FROM,
      to,
      subject: `Daily Report — ${shop.name} — ${stats.dateLabel}`,
      html: buildDailyReportHtml(shop.name, stats),
      text: buildDailyReportSms(stats),
    })
    emailed = !result.error
    if (result.error) {
      console.error('[daily-report] email failed', shop.id, result.error.message)
    }
  }

  let smsSent = false
  if (shop.sms_enabled && shop.phone?.trim()) {
    const smsResult = await sendShopSms({
      shopId: shop.id,
      to: shop.phone,
      message: buildDailyReportSms(stats),
      priority: 'normal',
    })
    smsSent = smsResult.sent
  }

  return { emailed, smsSent }
}
