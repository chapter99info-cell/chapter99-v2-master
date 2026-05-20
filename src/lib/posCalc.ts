// Chapter99 V4 — Phase 5
// POS Calculation Engine
// All calculations in AUD, rounded to 2dp

import type { BillItem, PaymentBreakdown, PaymentMethod, PaymentSplit } from '../types/pos'

const SURCHARGE_RATES: Record<string, number> = {
  cash: 0,
  payid: 0,
  card: 0.015,    // 1.5% ACCC compliant
  hicaps: 0,
  amex: 0.02,     // 2.0%
}

const GP_RATES: Record<string, number> = {
  cash: 0,
  payid: 0,
  card: 0.016,    // Stripe ~1.6% actual cost
  hicaps: 0.005,  // HICAPS terminal fee
  amex: 0.021,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

type SplittableMethod = Exclude<PaymentMethod, 'split'>

export function calcPayment(
  items: BillItem[],
  method: SplittableMethod
): PaymentBreakdown {
  const subtotal = round2(items.reduce((sum, i) => sum + i.price, 0))
  const gstFreeAmt = round2(
    items.filter(i => i.gstFree).reduce((sum, i) => sum + i.price, 0)
  )
  const taxableAmt = round2(subtotal - gstFreeAmt)

  // GST = 1/11 of taxable amount (AU standard)
  const gst = round2(taxableAmt / 11)
  const exGst = round2(subtotal - gst)

  const surchargeRate = SURCHARGE_RATES[method] ?? 0
  const surcharge = round2(subtotal * surchargeRate)

  const total = round2(subtotal + surcharge)

  const gpCost = round2(total * (GP_RATES[method] ?? 0))
  const netRevenue = round2(total - gpCost)

  return {
    subtotal,
    gstFreeAmt,
    taxableAmt,
    gst,
    exGst,
    surcharge,
    surchargeRate,
    total,
    gpCost,
    netRevenue,
  }
}

export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function generateReceiptId(shopCode: string): string {
  const date = new Date()
  const y = date.getFullYear()
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase()
  return `${shopCode}-${y}-${rand}`
}

// Validate surcharge is ACCC compliant (cannot exceed cost of acceptance)
export function validateSurcharge(
  surchargeRate: number,
  method: PaymentMethod
): boolean {
  const maxAllowed = GP_RATES[method] ?? 0
  // Allow small buffer (0.1%) for rounding
  return surchargeRate <= maxAllowed + 0.001
}

// Calculate therapist commission for a transaction
export function calcCommission(
  subtotal: number,
  commissionRate: number
): { therapistEarns: number; shopEarns: number } {
  const therapistEarns = round2(subtotal * commissionRate)
  const shopEarns = round2(subtotal - therapistEarns)
  return { therapistEarns, shopEarns }
}

/** Payment breakdown when bill is split across up to 3 methods */
export function calcPaymentWithSplits(
  items: BillItem[],
  splits: PaymentSplit[]
): PaymentBreakdown {
  const base = calcPayment(items, 'cash')
  if (splits.length === 0) return base

  let surcharge = 0
  let gpCost = 0
  for (const s of splits) {
    const rate = SURCHARGE_RATES[s.method] ?? 0
    const gp = GP_RATES[s.method] ?? 0
    surcharge = round2(surcharge + s.amount * rate)
    gpCost = round2(gpCost + s.amount * gp)
  }

  const total = round2(base.subtotal + surcharge)
  const netRevenue = round2(total - gpCost)
  const primary = splits[0]?.method ?? 'cash'
  const surchargeRate = SURCHARGE_RATES[primary] ?? 0

  return {
    ...base,
    surcharge,
    surchargeRate,
    total,
    gpCost,
    netRevenue,
  }
}

export function splitTotalAmount(splits: PaymentSplit[]): number {
  return round2(splits.reduce((sum, s) => sum + s.amount, 0))
}
