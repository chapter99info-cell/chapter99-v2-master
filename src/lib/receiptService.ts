// Chapter99 V4 — Issue receipts: PDF, DB history, email

import { supabase } from './supabase'
import type { Transaction, Shop } from '../types/pos'
import { downloadReceiptPDF, receiptPDFToBase64 } from './receiptPDF'
import { sendReceiptEmail } from './notifyService'
import { saveTransaction } from './posDb'

export interface IssueReceiptResult {
  ok: boolean
  emailSent: boolean
  error?: string
}

export async function saveReceiptRecord(
  tx: Transaction,
  shop: Shop,
  opts: { emailSent: boolean; healthFund?: boolean; pdfUrl?: string }
): Promise<void> {
  await supabase.from('receipts').insert({
    shop_id: shop.id,
    transaction_id: tx.id,
    receipt_number: tx.id,
    client_name: tx.clientName ?? null,
    client_email: tx.clientEmail ?? null,
    payment_method: tx.paymentMethod,
    total: tx.payment.total,
    pdf_url: opts.pdfUrl ?? null,
    email_sent: opts.emailSent,
    health_fund: opts.healthFund ?? tx.paymentMethod === 'hicaps',
    issued_at: tx.paidAt ?? tx.createdAt,
  })
}

/** Download PDF, persist receipt row, email if address provided */
export async function issueReceipt(
  tx: Transaction,
  shop: Shop
): Promise<IssueReceiptResult> {
  let emailSent = false

  try {
    if (tx.clientEmail) {
      const pdfBase64 = await receiptPDFToBase64(tx, shop)
      emailSent = await sendReceiptEmail(tx, shop.name, pdfBase64)
    }

    await saveReceiptRecord(tx, shop, { emailSent })

    const updated: Transaction = { ...tx, receiptSent: emailSent || !!tx.clientEmail }
    await saveTransaction(updated)

    return { ok: true, emailSent }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to issue receipt'
    return { ok: false, emailSent: false, error: message }
  }
}

export async function downloadAndRecordReceipt(
  tx: Transaction,
  shop: Shop
): Promise<IssueReceiptResult> {
  try {
    await downloadReceiptPDF(tx, shop)
    await saveReceiptRecord(tx, shop, { emailSent: tx.receiptSent })
    return { ok: true, emailSent: tx.receiptSent }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed'
    return { ok: false, emailSent: false, error: message }
  }
}
