// Chapter99 V4 — Phase 6
// Owner Alert System
// Insurance / Visa / BAS / Inventory alerts
// Runs via Supabase Edge Function or Vercel Cron

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type AlertSeverity = 'critical' | 'warning' | 'notice'
export type AlertType =
  | 'indemnity_insurance'
  | 'liability_insurance'
  | 'firstaid_cert'
  | 'visa_expiry'
  | 'bas_due'
  | 'low_revenue'
  | 'no_bookings'
  | 'google_review'

export interface Alert {
  id: string
  shopId: string
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  daysRemaining?: number
  staffName?: string
  actionUrl?: string
  createdAt: string
  dismissed: boolean
}

// ── Check all alerts for a shop ───────────────────────────────
export async function checkAllAlerts(shopId: string): Promise<Alert[]> {
  const alerts: Alert[] = []

  const [staffAlerts, basAlerts, revenueAlerts] = await Promise.all([
    checkStaffAlerts(shopId),
    checkBASAlerts(shopId),
    checkRevenueAlerts(shopId),
  ])

  alerts.push(...staffAlerts, ...basAlerts, ...revenueAlerts)

  // Sort: critical first, then days remaining
  return alerts.sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, notice: 2 }
    if (severityOrder[a.severity] !== severityOrder[b.severity]) {
      return severityOrder[a.severity] - severityOrder[b.severity]
    }
    return (a.daysRemaining ?? 999) - (b.daysRemaining ?? 999)
  })
}

// ── Staff Document Alerts ─────────────────────────────────────
async function checkStaffAlerts(shopId: string): Promise<Alert[]> {
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name_en, indemnity_expiry, liability_expiry, firstaid_expiry, visa_expiry')
    .eq('shop_id', shopId)
    .eq('active', true)

  if (!staff) return []

  const alerts: Alert[] = []
  const today = new Date()

  staff.forEach(s => {
    // Insurance checks
    const checks = [
      {
        type: 'indemnity_insurance' as AlertType,
        expiry: s.indemnity_expiry,
        label: 'Professional Indemnity Insurance',
      },
      {
        type: 'liability_insurance' as AlertType,
        expiry: s.liability_expiry,
        label: 'Public Liability Insurance',
      },
      {
        type: 'firstaid_cert' as AlertType,
        expiry: s.firstaid_expiry,
        label: 'First Aid Certificate',
      },
      {
        type: 'visa_expiry' as AlertType,
        expiry: s.visa_expiry,
        label: 'Visa / Work Rights',
      },
    ]

    checks.forEach(({ type, expiry, label }) => {
      if (!expiry) return
      const expiryDate = new Date(expiry)
      const daysRemaining = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      )

      let severity: AlertSeverity | null = null
      if (daysRemaining <= 7) severity = 'critical'
      else if (daysRemaining <= 30) severity = 'warning'
      else if (daysRemaining <= 60) severity = 'notice'

      if (severity) {
        alerts.push({
          id: `${s.id}-${type}`,
          shopId,
          type,
          severity,
          title: `${label} — ${s.name_en}`,
          message: daysRemaining <= 0
            ? `EXPIRED — Renew immediately`
            : `Expires in ${daysRemaining} days (${expiryDate.toLocaleDateString('en-AU')})`,
          daysRemaining,
          staffName: s.name_en,
          createdAt: new Date().toISOString(),
          dismissed: false,
        })
      }
    })
  })

  return alerts
}

// ── BAS / Tax Alerts ──────────────────────────────────────────
async function checkBASAlerts(shopId: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  const today = new Date()

  // AU BAS due dates (28 days after quarter end)
  const basDates = [
    { quarter: 'Q1 Jul-Sep', due: new Date(today.getFullYear(), 9, 28) },
    { quarter: 'Q2 Oct-Dec', due: new Date(today.getFullYear() + 1, 1, 28) },
    { quarter: 'Q3 Jan-Mar', due: new Date(today.getFullYear(), 3, 28) },
    { quarter: 'Q4 Apr-Jun', due: new Date(today.getFullYear(), 6, 28) },
  ]

  basDates.forEach(({ quarter, due }) => {
    const daysRemaining = Math.ceil(
      (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysRemaining > 0 && daysRemaining <= 30) {
      alerts.push({
        id: `bas-${quarter.replace(/\s/g, '-')}`,
        shopId,
        type: 'bas_due',
        severity: daysRemaining <= 7 ? 'critical' : 'warning',
        title: `BAS Due — ${quarter}`,
        message: `Submit to ATO by ${due.toLocaleDateString('en-AU')} (${daysRemaining} days)`,
        daysRemaining,
        actionUrl: 'https://www.ato.gov.au/bas',
        createdAt: new Date().toISOString(),
        dismissed: false,
      })
    }
  })

  return alerts
}

// ── Revenue Alerts ────────────────────────────────────────────
async function checkRevenueAlerts(shopId: string): Promise<Alert[]> {
  const alerts: Alert[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Check today's bookings
  const { data: todayBookings } = await supabase
    .from('bookings')
    .select('id')
    .eq('shop_id', shopId)
    .gte('start_time', today.toISOString())
    .lt('start_time', new Date(today.getTime() + 86400000).toISOString())
    .neq('status', 'cancelled')

  if (!todayBookings || todayBookings.length === 0) {
    alerts.push({
      id: `no-bookings-${today.toISOString()}`,
      shopId,
      type: 'no_bookings',
      severity: 'notice',
      title: 'No bookings today',
      message: 'Consider posting on social media or running a same-day promotion',
      createdAt: new Date().toISOString(),
      dismissed: false,
    })
  }

  return alerts
}

// ── Send Alert Notifications ──────────────────────────────────
export async function sendAlertNotifications(
  shopId: string,
  ownerPhone: string
): Promise<void> {
  const alerts = await checkAllAlerts(shopId)
  const critical = alerts.filter(a => a.severity === 'critical')

  if (critical.length === 0) return

  // SMS for critical alerts only
  const msg = critical.slice(0, 3).map(a =>
    `🔴 ${a.title}: ${a.message}`
  ).join('\n')

  await fetch('/api/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: ownerPhone,
      message: `Chapter99 Alert:\n${msg}\n\nLogin to manage: chapter99.com.au/admin`,
    }),
  })
}

// ── Vercel Cron: runs daily at 8am ───────────────────────────
// Add to vercel.json:
// "crons": [{ "path": "/api/cron/alerts", "schedule": "0 8 * * *" }]
export async function cronDailyAlerts() {
  const { data: shops } = await supabase
    .from('shops')
    .select('id, phone')
    .eq('active', true)

  if (!shops) return

  for (const shop of shops) {
    await sendAlertNotifications(shop.id, shop.phone)
  }
}
