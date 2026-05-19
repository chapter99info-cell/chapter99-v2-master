// Chapter99 V4 — Phase 6
// Google Sheets Tax Report Service
// Auto-syncs POS transactions → Google Sheet for accountant

import type { Transaction } from '../types/pos'

// ── Vercel API: /api/google-sheet.ts ─────────────────────────
// Called after every POS transaction closes
// Also runs as monthly batch job

const SHEET_TABS = {
  TRANSACTIONS: 'Transactions',
  MONTHLY: 'Monthly Summary',
  BAS: 'BAS Worksheet',
  PAYROLL: 'Payroll',
  EXPENSES: 'Expenses',
}

// Transaction row columns (matches Sheet headers)
export function buildTransactionRow(tx: Transaction): (string | number)[] {
  const date = new Date(tx.paidAt ?? tx.createdAt)
  return [
    date.toLocaleDateString('en-AU'),                    // A: Date
    tx.id,                                               // B: Receipt No
    tx.clientName ?? '',                                  // C: Client
    tx.items.map(i => i.serviceName).join(', '),         // D: Services
    tx.payment.subtotal,                                 // E: Gross
    tx.payment.gst,                                      // F: GST Collected
    tx.payment.exGst,                                    // G: Ex-GST
    tx.payment.gstFreeAmt,                               // H: GST-Free Amount
    tx.payment.surcharge,                                // I: Surcharge
    tx.payment.tip,                                      // J: Tips
    tx.payment.total,                                    // K: Total Charged
    tx.paymentMethod.toUpperCase(),                      // L: Payment Method
    tx.payment.gpCost,                                   // M: GP Cost
    tx.payment.netRevenue,                               // N: Net Revenue
    tx.therapistName ?? '',                              // O: Therapist
    tx.status,                                           // P: Status
    tx.healthFundIssued ? 'YES' : 'No',                  // Q: Health Fund
  ]
}

// Sheet headers (set up once)
export const TRANSACTION_HEADERS = [
  'Date', 'Receipt No', 'Client', 'Services',
  'Gross ($)', 'GST Collected ($)', 'Ex-GST ($)', 'GST-Free ($)',
  'Card Surcharge ($)', 'Tips ($)', 'Total Charged ($)',
  'Payment Method', 'GP Cost ($)', 'Net Revenue ($)',
  'Therapist', 'Status', 'Health Fund',
]

// ── API Route: POST /api/sync-sheet ──────────────────────────
export async function syncTransactionToSheet(tx: Transaction): Promise<boolean> {
  try {
    const res = await fetch('/api/sync-sheet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transaction: tx }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ── BAS Worksheet Calculator ──────────────────────────────────
interface BASData {
  quarterLabel: string
  periodStart: string
  periodEnd: string
  // G fields
  G1_totalSales: number
  G3_gstFreeSales: number
  G10_capitalPurchases: number
  G11_nonCapitalPurchases: number
  // 1A / 1B
  oneA_gstOnSales: number
  oneB_gstOnPurchases: number
  gstPayable: number
  dueDate: string
}

export function calculateBAS(
  transactions: Transaction[],
  expenses: { amount: number; gst: number; isCapital: boolean }[],
  quarterLabel: string,
  periodStart: Date,
  periodEnd: Date,
  dueDate: Date
): BASData {
  const paid = transactions.filter(t => t.status === 'paid')

  const G1 = paid.reduce((s, t) => s + t.payment.subtotal, 0)
  const G3 = paid.reduce((s, t) => s + t.payment.gstFreeAmt, 0)
  const G10 = expenses
    .filter(e => e.isCapital)
    .reduce((s, e) => s + e.amount, 0)
  const G11 = expenses
    .filter(e => !e.isCapital)
    .reduce((s, e) => s + e.amount, 0)

  const oneA = paid.reduce((s, t) => s + t.payment.gst, 0)
  const oneB = expenses.reduce((s, e) => s + e.gst, 0)

  return {
    quarterLabel,
    periodStart: periodStart.toLocaleDateString('en-AU'),
    periodEnd: periodEnd.toLocaleDateString('en-AU'),
    G1_totalSales: round2(G1),
    G3_gstFreeSales: round2(G3),
    G10_capitalPurchases: round2(G10),
    G11_nonCapitalPurchases: round2(G11),
    oneA_gstOnSales: round2(oneA),
    oneB_gstOnPurchases: round2(oneB),
    gstPayable: round2(oneA - oneB),
    dueDate: dueDate.toLocaleDateString('en-AU'),
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// ── Google Drive PDF Archive ──────────────────────────────────
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
