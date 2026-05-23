/**
 * Google Sheets sync core (server-side)
 *
 * Vercel environment variables:
 *   GOOGLE_SERVICE_ACCOUNT_EMAIL — service account client_email
 *   GOOGLE_PRIVATE_KEY — private key (use \n for newlines in Vercel)
 *
 * Share your spreadsheet with the service account email (Editor access).
 */

import { JWT } from 'google-auth-library'
import { GoogleSpreadsheet } from 'google-spreadsheet'
import type { Transaction } from '../src/types/pos'
import {
  BOOKING_HEADERS,
  DAILY_SUMMARY_HEADERS,
  TRANSACTION_HEADERS,
  type BookingSheetRow,
} from '../src/lib/sheetConstants'

export const SHEET_TRANSACTIONS = 'Transactions'
export const SHEET_BOOKINGS = 'Bookings'
export const SHEET_DAILY_SUMMARY = 'Daily Summary'

export { TRANSACTION_HEADERS, BOOKING_HEADERS, DAILY_SUMMARY_HEADERS }
export type { BookingSheetRow }

export function parseSpreadsheetId(urlOrId: string): string | null {
  const trimmed = urlOrId.trim()
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed) && !trimmed.includes('/')) {
    return trimmed
  }
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}

function getServiceAccountAuth(): JWT {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')

  if (!email || !key) {
    throw new Error(
      'Missing GOOGLE_SERVICE_ACCOUNT_EMAIL or GOOGLE_PRIVATE_KEY in environment'
    )
  }

  return new JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export async function openSpreadsheet(spreadsheetUrl: string): Promise<GoogleSpreadsheet> {
  const spreadsheetId = parseSpreadsheetId(spreadsheetUrl)
  if (!spreadsheetId) {
    throw new Error('Invalid Google Sheet URL or spreadsheet ID')
  }

  const doc = new GoogleSpreadsheet(spreadsheetId, getServiceAccountAuth())
  await doc.loadInfo()
  return doc
}

async function ensureSheet(
  doc: GoogleSpreadsheet,
  title: string,
  headers: string[]
) {
  let sheet = doc.sheetsByTitle[title]
  if (!sheet) {
    sheet = await doc.addSheet({ title, headerValues: headers })
    return sheet
  }

  await sheet.loadHeaderRow()
  if (!sheet.headerValues?.length) {
    await sheet.setHeaderRow(headers)
  }
  return sheet
}

export async function testSpreadsheetConnection(
  spreadsheetUrl: string
): Promise<{ title: string; sheetTitles: string[] }> {
  const doc = await openSpreadsheet(spreadsheetUrl)
  return {
    title: doc.title,
    sheetTitles: doc.sheetsByIndex.map(s => s.title),
  }
}

function txToSheetRow(tx: Transaction): Record<string, string | number> {
  const paidAt = new Date(tx.paidAt ?? tx.createdAt)
  return {
    transaction_id: tx.id,
    date: paidAt.toLocaleDateString('en-AU'),
    time: paidAt.toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' }),
    services: tx.items.map(i => i.serviceName).join(', '),
    amount: tx.payment.total,
    GST: tx.payment.gst,
    payment_method: tx.paymentMethod.toUpperCase(),
    customer: tx.clientName ?? '',
  }
}

export async function appendTransactionRow(
  spreadsheetUrl: string,
  tx: Transaction
): Promise<void> {
  const doc = await openSpreadsheet(spreadsheetUrl)
  const sheet = await ensureSheet(doc, SHEET_TRANSACTIONS, [...TRANSACTION_HEADERS])
  await sheet.addRow(txToSheetRow(tx))
}

export async function appendBookingRow(
  spreadsheetUrl: string,
  booking: BookingSheetRow
): Promise<void> {
  const doc = await openSpreadsheet(spreadsheetUrl)
  const sheet = await ensureSheet(doc, SHEET_BOOKINGS, [...BOOKING_HEADERS])
  await sheet.addRow({
    booking_id: booking.bookingId,
    date: booking.date,
    time: booking.time,
    service: booking.service,
    customer: booking.customer,
    phone: booking.phone,
    status: booking.status,
  })
}

export async function upsertDailySummary(
  spreadsheetUrl: string,
  date: string,
  totalRevenue: number,
  totalBookings: number,
  paymentBreakdown: Record<string, number>
): Promise<void> {
  const doc = await openSpreadsheet(spreadsheetUrl)
  const sheet = await ensureSheet(doc, SHEET_DAILY_SUMMARY, [...DAILY_SUMMARY_HEADERS])
  await sheet.loadCells()

  const rows = await sheet.getRows()
  const existing = rows.find(r => String(r.get('date')) === date)

  const breakdownStr = Object.entries(paymentBreakdown)
    .map(([method, amt]) => `${method}: $${amt.toFixed(2)}`)
    .join(' | ')

  if (existing) {
    existing.set('total_revenue', totalRevenue)
    existing.set('total_bookings', totalBookings)
    existing.set('payment_methods_breakdown', breakdownStr)
    await existing.save()
  } else {
    await sheet.addRow({
      date,
      total_revenue: totalRevenue,
      total_bookings: totalBookings,
      payment_methods_breakdown: breakdownStr,
    })
  }
}

/** Rebuild daily summary from transaction rows already in the sheet */
export async function refreshDailySummaryFromTransactions(
  spreadsheetUrl: string,
  date: string
): Promise<void> {
  const doc = await openSpreadsheet(spreadsheetUrl)
  const txSheet = doc.sheetsByTitle[SHEET_TRANSACTIONS]
  if (!txSheet) {
    await upsertDailySummary(spreadsheetUrl, date, 0, 0, {})
    return
  }

  await txSheet.loadHeaderRow()
  const rows = await txSheet.getRows()
  const dayRows = rows.filter(r => String(r.get('date')) === date)

  let totalRevenue = 0
  const breakdown: Record<string, number> = {}

  for (const row of dayRows) {
    const amount = Number(row.get('amount')) || 0
    const method = String(row.get('payment_method') || 'unknown').toLowerCase()
    totalRevenue += amount
    breakdown[method] = (breakdown[method] || 0) + amount
  }

  const bookSheet = doc.sheetsByTitle[SHEET_BOOKINGS]
  let totalBookings = 0
  if (bookSheet) {
    await bookSheet.loadHeaderRow()
    const bookRows = await bookSheet.getRows()
    totalBookings = bookRows.filter(r => String(r.get('date')) === date).length
  }

  await upsertDailySummary(
    spreadsheetUrl,
    date,
    Math.round(totalRevenue * 100) / 100,
    totalBookings,
    breakdown
  )
}
