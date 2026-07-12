/**
 * POST /api/sheets-sync
 *
 * Body:
 *   action: 'test' | 'sync_transaction' | 'sync_booking' | 'daily_summary'
 *   spreadsheetUrl: string (required except when using shopId-only with server lookup)
 *   shopId?: string
 *   transaction?: Transaction
 *   booking?: BookingSheetRow
 *   date?: string (YYYY-MM-DD or en-AU date for daily_summary)
 *
 * Environment (Vercel):
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL=your-sa@project.iam.gserviceaccount.com
 *   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
 */

import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { Transaction } from '../src/types/pos'
import {
  appendBookingRow,
  appendTransactionRow,
  refreshDailySummaryFromTransactions,
  testSpreadsheetConnection,
  type BookingSheetRow,
} from '../server/sheetsSyncCore'

type SheetsSyncAction =
  | 'test'
  | 'sync_transaction'
  | 'sync_booking'
  | 'daily_summary'

interface SheetsSyncBody {
  action: SheetsSyncAction
  spreadsheetUrl: string
  shopId?: string
  transaction?: Transaction
  booking?: BookingSheetRow
  date?: string
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const body = req.body as SheetsSyncBody
  const { action, spreadsheetUrl } = body

  if (!action) {
    return res.status(400).json({ error: 'Missing action' })
  }

  if (!spreadsheetUrl?.trim()) {
    return res.status(400).json({ error: 'Missing spreadsheetUrl' })
  }

  // Optional integration — do not 500 the POS checkout path when unset
  if (
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() ||
    !process.env.GOOGLE_PRIVATE_KEY?.trim()
  ) {
    console.warn('[sheets-sync] skipped: GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY not set')
    return res.status(200).json({
      success: false,
      skipped: true,
      error: 'Google Sheets sync is not configured on this deployment',
    })
  }

  try {
    switch (action) {
      case 'test': {
        const info = await testSpreadsheetConnection(spreadsheetUrl)
        return res.json({ success: true, ...info })
      }

      case 'sync_transaction': {
        if (!body.transaction) {
          return res.status(400).json({ error: 'Missing transaction' })
        }
        await appendTransactionRow(spreadsheetUrl, body.transaction)
        const paidAt = new Date(
          body.transaction.paidAt ?? body.transaction.createdAt
        )
        const dateStr = paidAt.toLocaleDateString('en-AU')
        await refreshDailySummaryFromTransactions(spreadsheetUrl, dateStr)
        return res.json({ success: true })
      }

      case 'sync_booking': {
        if (!body.booking) {
          return res.status(400).json({ error: 'Missing booking' })
        }
        await appendBookingRow(spreadsheetUrl, body.booking)
        await refreshDailySummaryFromTransactions(
          spreadsheetUrl,
          body.booking.date
        )
        return res.json({ success: true })
      }

      case 'daily_summary': {
        const dateStr =
          body.date ?? new Date().toLocaleDateString('en-AU', { timeZone: 'Australia/Sydney' })
        await refreshDailySummaryFromTransactions(spreadsheetUrl, dateStr)
        return res.json({ success: true, date: dateStr })
      }

      default:
        return res.status(400).json({ error: 'Unknown action' })
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Sheets sync failed'
    console.error('[sheets-sync]', action, message)
    // Soft-fail for POS: credentials/share errors shouldn't block checkout UX
    return res.status(200).json({ success: false, skipped: true, error: message })
  }
}
