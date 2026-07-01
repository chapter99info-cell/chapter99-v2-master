import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './supabaseServer'
import { sendDailyReportForShop, shopIsAtReportHour } from './dailyReportCore'

export async function runCronDailyReport(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const sb = getServiceSupabase()
  const { data: shops, error } = await sb
    .from('shops')
    .select(
      'id, name, email, notification_email, phone, sms_enabled, daily_report_hour, daily_report_timezone'
    )
    .eq('active', true)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  let processed = 0
  const results: { shopId: string; emailed: boolean; smsSent: boolean }[] = []

  for (const shop of shops ?? []) {
    const tz = (shop.daily_report_timezone as string) || 'Australia/Sydney'
    const hour = Number(shop.daily_report_hour) || 20
    if (!shopIsAtReportHour(tz, hour)) continue

    try {
      const result = await sendDailyReportForShop({
        id: shop.id as string,
        name: (shop.name as string) || 'Shop',
        email: shop.email as string | null,
        notification_email: shop.notification_email as string | null,
        phone: shop.phone as string | null,
        sms_enabled: shop.sms_enabled as boolean | null,
      })
      results.push({ shopId: shop.id as string, ...result })
      processed++
    } catch (err) {
      console.error('[cron/daily-report]', shop.id, err)
    }
  }

  return res.status(200).json({
    checked: shops?.length ?? 0,
    processed,
    results,
  })
}
