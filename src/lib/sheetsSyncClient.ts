// Chapter99 V4 — Client helpers for /api/sheets-sync

import type { Transaction } from '../types/pos'
import type { BookingSheetRow } from './sheetConstants'

async function postSheetsSync(body: Record<string, unknown>): Promise<{
  ok: boolean
  error?: string
  skipped?: boolean
  title?: string
  sheetTitles?: string[]
}> {
  try {
    const res = await fetch('/api/sheets-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as {
      error?: string
      skipped?: boolean
      success?: boolean
      title?: string
      sheetTitles?: string[]
    }
    if (data.skipped) {
      console.warn('[sheets-sync] skipped', data.error ?? 'not configured')
      return { ok: false, skipped: true, error: data.error }
    }
    if (!res.ok || data.success === false) {
      console.warn('[sheets-sync] failed', data.error ?? res.statusText)
      return { ok: false, error: data.error ?? res.statusText }
    }
    return { ok: true, title: data.title, sheetTitles: data.sheetTitles }
  } catch (err) {
    console.warn(
      '[sheets-sync] network error',
      err instanceof Error ? err.message : 'Network error'
    )
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Network error',
    }
  }
}

export async function testGoogleSheetConnection(
  spreadsheetUrl: string,
  shopId: string
): Promise<{ ok: boolean; title?: string; sheetTitles?: string[]; error?: string }> {
  return postSheetsSync({ action: 'test', spreadsheetUrl, shopId })
}

export async function syncTransactionToSheet(
  spreadsheetUrl: string,
  shopId: string,
  transaction: Transaction
): Promise<boolean> {
  const result = await postSheetsSync({
    action: 'sync_transaction',
    spreadsheetUrl,
    shopId,
    transaction,
  })
  return result.ok
}

export async function syncBookingToSheet(
  spreadsheetUrl: string,
  shopId: string,
  booking: BookingSheetRow
): Promise<boolean> {
  const result = await postSheetsSync({
    action: 'sync_booking',
    spreadsheetUrl,
    shopId,
    booking,
  })
  return result.ok
}

export async function refreshDailySheetSummary(
  spreadsheetUrl: string,
  shopId: string,
  date?: string
): Promise<boolean> {
  const result = await postSheetsSync({
    action: 'daily_summary',
    spreadsheetUrl,
    shopId,
    date,
  })
  return result.ok
}

export type { BookingSheetRow }
