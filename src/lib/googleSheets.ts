// Chapter99 V4 — Google Sheets tax reporting (client)

import type { Transaction } from '../types/pos'

export {
  TRANSACTION_HEADERS,
  BOOKING_HEADERS,
  DAILY_SUMMARY_HEADERS,
} from './sheetConstants'

export {
  testGoogleSheetConnection,
  syncTransactionToSheet,
  syncBookingToSheet,
  refreshDailySheetSummary,
} from './sheetsSyncClient'

export type { BookingSheetRow } from './sheetConstants'

export function buildTransactionRow(tx: Transaction): (string | number)[] {
  const date = new Date(tx.paidAt ?? tx.createdAt)
  return [
    date.toLocaleDateString('en-AU'),
    tx.id,
    tx.clientName ?? '',
    tx.items.map(i => i.serviceName).join(', '),
    tx.payment.subtotal,
    tx.payment.gst,
    tx.payment.exGst,
    tx.payment.gstFreeAmt,
    tx.payment.surcharge,
    tx.payment.tip,
    tx.payment.total,
    tx.paymentMethod.toUpperCase(),
    tx.payment.gpCost,
    tx.payment.netRevenue,
    tx.therapistName ?? '',
    tx.status,
    tx.healthFundIssued ? 'YES' : 'No',
  ]
}

export async function archivePDFtoDrive(
  pdfBlob: Blob,
  fileName: string,
  shopId: string
): Promise<string | null> {
  try {
    const formData = new FormData()
    formData.append('file', pdfBlob, fileName)
    formData.append('shopId', shopId)
    formData.append('fileName', fileName)

    const res = await fetch('/api/drive-upload', {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) return null
    const { driveUrl } = await res.json()
    return driveUrl
  } catch {
    return null
  }
}
