import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

type AlertSeverity = 'critical' | 'warning' | 'notice'

function daysUntil(expiry: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiry + 'T12:00:00')
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function severityForDays(days: number): AlertSeverity | null {
  if (days <= 7) return 'critical'
  if (days <= 30) return 'warning'
  return null
}

export async function runCronAlerts(req: VercelRequest, res: VercelResponse) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return res.status(500).json({ error: 'CRON_SECRET not configured' })
  }
  if (req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )

  const { data: shops, error: shopsErr } = await supabase
    .from('shops')
    .select('id')
    .eq('active', true)

  if (shopsErr) {
    return res.status(500).json({ error: shopsErr.message })
  }

  let inserted = 0
  const errors: string[] = []

  for (const shop of shops ?? []) {
    const { data: staff, error: staffErr } = await supabase
      .from('staff')
      .select('id, name_en, indemnity_expiry, liability_expiry, firstaid_expiry, visa_expiry')
      .eq('shop_id', shop.id)
      .eq('active', true)

    if (staffErr) {
      errors.push(`${shop.id}: ${staffErr.message}`)
      continue
    }

    const checks = [
      { type: 'indemnity_insurance', field: 'indemnity_expiry' as const, label: 'Professional Indemnity Insurance' },
      { type: 'liability_insurance', field: 'liability_expiry' as const, label: 'Public Liability Insurance' },
      { type: 'firstaid_cert', field: 'firstaid_expiry' as const, label: 'First Aid Certificate' },
      { type: 'visa_expiry', field: 'visa_expiry' as const, label: 'Visa / Work Rights' },
    ]

    for (const s of staff ?? []) {
      for (const { type, field, label } of checks) {
        const expiry = s[field] as string | null
        if (!expiry) continue

        const days = daysUntil(expiry)
        const severity = severityForDays(days)
        if (!severity) continue

        const alertId = `${shop.id}-${s.id}-${type}-${expiry}`
        const message =
          days <= 0
            ? `EXPIRED — Renew immediately (${expiry})`
            : `Expires in ${days} days (${expiry})`

        const { error: upsertErr } = await supabase.from('alerts').upsert(
          {
            id: alertId,
            shop_id: shop.id,
            type,
            severity,
            title: `${label} — ${s.name_en}`,
            message,
            staff_id: s.id,
            days_remaining: days,
            dismissed: false,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )

        if (upsertErr) {
          errors.push(`${alertId}: ${upsertErr.message}`)
        } else {
          inserted++
        }
      }
    }
  }

  console.log(`[cron/alerts] inserted/updated ${inserted} alerts`)

  return res.json({
    success: true,
    shops: shops?.length ?? 0,
    alertsUpserted: inserted,
    errors,
  })
}
