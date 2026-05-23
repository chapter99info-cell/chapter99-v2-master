/**
 * Vercel Cron — refresh Daily Summary for all shops with Google Sheets sync enabled
 * Schedule in vercel.json: "0 14 * * *" (~midnight AEST)
 *
 * Requires: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *           GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'
import { refreshDailySummaryFromTransactions } from '../../server/sheetsSyncCore'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '',
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  )

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
