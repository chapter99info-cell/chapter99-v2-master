// Chapter99 V4 — Issue receipts: jsPDF, DB history, email
//
// Live `public.receipts` columns (euiwkvozrhnbxttfuchh) are narrower than
// supabase/05-receipt-system.sql — map to what exists:
//   id, shop_id, transaction_id, receipt_number, payment_method,
//   created_at, customer_name, customer_email, total_amount
// Do NOT query issued_at / client_* / email_sent / health_fund / transaction_data.

import { supabase } from './supabase'
import type { Transaction, Shop } from '../types/pos'
import {
  downloadReceiptPDF,
  receiptPDFToBase64,
} from '../components/receipt/ReceiptPDF'
import { generateHealthFundBase64 } from './healthFundPDF'
import { sendHealthFundEmail, sendReceiptEmail } from './notifyService'
import { saveTransaction } from './posDb'

export interface IssueReceiptResult {
  ok: boolean
  emailSent: boolean
  receiptNumber?: string
  error?: string
}

function todayReceiptPrefix(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `REC-${y}${m}${d}`
}

/** REC-YYYYMMDD-001 — sequence from receipt_number prefix (no issued_at column). */
export async function generateReceiptNumber(shopId: string): Promise<string> {
  const prefix = todayReceiptPrefix()

  const { count, error } = await supabase
    .from('receipts')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .like('receipt_number', `${prefix}-%`)

  if (error) {
    console.warn('[receipts] generateReceiptNumber count failed', error.message)
    const fallback = String(Math.floor(Math.random() * 900) + 100)
    return `${prefix}-${fallback}`
  }

  const seq = String((count ?? 0) + 1).padStart(3, '0')
  return `${prefix}-${seq}`
}

export async function getReceiptNumberForTransaction(
  shopId: string,
  transactionId: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from('receipts')
    .select('receipt_number')
    .eq('shop_id', shopId)
    .eq('transaction_id', transactionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.warn('[receipts] getReceiptNumberForTransaction failed', error.message)
    return null
  }

  return data?.receipt_number ?? null
}

export async function resolveReceiptNumber(
  shopId: string,
  transactionId: string
): Promise<string> {
  const existing = await getReceiptNumberForTransaction(shopId, transactionId)
  if (existing) return existing
  return generateReceiptNumber(shopId)
}

export async function saveReceiptRecord(
  tx: Transaction,
  shop: Shop,
  receiptNumber: string,
  opts: { emailSent: boolean; healthFund?: boolean }
): Promise<void> {
  void opts // email_sent / health_fund not on live schema yet

  const payload = {
    shop_id: shop.id,
    transaction_id: tx.id,
    receipt_number: receiptNumber,
    customer_name: tx.clientName ?? null,
    customer_email: tx.clientEmail ?? null,
    payment_method: tx.paymentMethod,
    total_amount: tx.payment.total,
  }

  const { data: existing, error: lookupError } = await supabase
    .from('receipts')
    .select('id')
    .eq('shop_id', shop.id)
    .eq('transaction_id', tx.id)
    .maybeSingle()

  if (lookupError) {
    console.warn('[receipts] lookup failed', lookupError.message)
  }

  if (existing?.id) {
    const { error } = await supabase
      .from('receipts')
      .update({
        customer_name: payload.customer_name,
        customer_email: payload.customer_email,
        payment_method: payload.payment_method,
        total_amount: payload.total_amount,
        receipt_number: receiptNumber,
      })
      .eq('id', existing.id)
    if (error) console.warn('[receipts] update failed', error.message)
    return
  }

  const { error } = await supabase.from('receipts').insert(payload)
  if (error) console.warn('[receipts] insert failed', error.message)
}

export async function downloadAndRecordReceipt(
  tx: Transaction,
  shop: Shop
): Promise<IssueReceiptResult> {
  try {
    const receiptNumber = await resolveReceiptNumber(shop.id, tx.id)
    await downloadReceiptPDF(tx, shop, { receiptNumber })
    await saveReceiptRecord(tx, shop, receiptNumber, { emailSent: tx.receiptSent })
    return { ok: true, emailSent: tx.receiptSent, receiptNumber }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Download failed'
    return { ok: false, emailSent: false, error: message }
  }
}

export async function emailReceipt(
  tx: Transaction,
  shop: Shop,
  toEmail?: string
): Promise<IssueReceiptResult> {
  const email = (toEmail ?? tx.clientEmail)?.trim()
  if (!email) {
    return { ok: false, emailSent: false, error: 'No customer email on this sale' }
  }

  try {
    const txForSend: Transaction = { ...tx, clientEmail: email }
    const receiptNumber = await resolveReceiptNumber(shop.id, tx.id)
    const pdfBase64 = await receiptPDFToBase64(txForSend, shop, { receiptNumber })
    const emailSent = await sendReceiptEmail(txForSend, shop.name, pdfBase64, email)

    await saveReceiptRecord(txForSend, shop, receiptNumber, {
      emailSent,
      healthFund: tx.paymentMethod === 'hicaps',
    })

    if (emailSent) {
      const updated: Transaction = { ...txForSend, receiptSent: true }
      await saveTransaction(updated)
    }

    return {
      ok: emailSent,
      emailSent,
      receiptNumber,
      error: emailSent ? undefined : 'Email service unavailable',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Email failed'
    return { ok: false, emailSent: false, error: message }
  }
}

export async function emailHealthFundReceipt(
  tx: Transaction,
  shop: Shop,
  toEmail?: string
): Promise<IssueReceiptResult> {
  const email = (toEmail ?? tx.clientEmail)?.trim()
  if (!email) {
    return { ok: false, emailSent: false, error: 'No customer email on this sale' }
  }

  try {
    const txForSend: Transaction = { ...tx, clientEmail: email, healthFundIssued: true }
    const pdfBase64 = await generateHealthFundBase64(txForSend, shop)
    const emailSent = await sendHealthFundEmail(txForSend, shop.name, pdfBase64, email)

    if (emailSent) {
      await saveTransaction(txForSend)
    }

    return {
      ok: emailSent,
      emailSent,
      error: emailSent ? undefined : 'Email service unavailable',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Health fund email failed'
    return { ok: false, emailSent: false, error: message }
  }
}

/** @deprecated use downloadAndRecordReceipt or emailReceipt explicitly */
export async function issueReceipt(
  tx: Transaction,
  shop: Shop
): Promise<IssueReceiptResult> {
  if (tx.clientEmail) return emailReceipt(tx, shop)
  return downloadAndRecordReceipt(tx, shop)
}
