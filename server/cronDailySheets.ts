import type { VercelRequest, VercelResponse } from '@vercel/node'
import { getServiceSupabase } from './supabaseServer'
import { refreshDailySummaryFromTransactions } from './sheetsSyncCore'

export async function runCronDailySheets(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = getServiceSupabase()

  const dateStr = new Date().toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney',
  })

  const { data: shops, error } = await supabase
    .from('shops')
    .select('id, name, google_sheet_url, google_sheet_sync_enabled')
    .eq('active', true)
    .eq('google_sheet_sync_enabled', true)
    .not('google_sheet_url', 'is', null)

  if (error) {
    return res.status(500).json({ error: error.message })
  }

  let processed = 0
  const failures: { shopId: string; error: string }[] = []

  for (const shop of shops ?? []) {
    if (!shop.google_sheet_url) continue
    try {
      await refreshDailySummaryFromTransactions(shop.google_sheet_url, dateStr)
      processed++
    } catch (err: unknown) {
      failures.push({
        shopId: shop.id,
        error: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  return res.json({
    success: true,
    date: dateStr,
    processed,
    failures,
  })
}
