// Chapter99 V4 — Phase 5
// POS Calculation Engine
// All calculations in AUD, rounded to 2dp

import type { BillItem, PaymentBreakdown, PaymentMethod } from '../types/pos'

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

export function calcPayment(
  items: BillItem[],
  method: PaymentMethod
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
