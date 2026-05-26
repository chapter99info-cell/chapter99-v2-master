import type { PayIDSettlement } from '../types/tour'

export function calcPayIDSettlement(
  tourCode: string,
  revenue: number,
  expenses: number,
  commissions: number,
  gstCollected = 0,
  gstClaimed = 0
): PayIDSettlement {
  const net = revenue - expenses - commissions
  return {
    tour_code: tourCode,
    total_revenue: revenue,
    total_expenses: expenses,
    total_commissions: commissions,
    net_profit: net,
    gst_collected: gstCollected,
    gst_claimed: gstClaimed,
  }
}

export function formatAUD(amount: number): string {
  return new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(amount)
}

export function generateReceiptFilename(tripCode: string, amount: number): string {
  const date = new Date().toISOString().split('T')[0]
  return `[${tripCode}]_[${date}]_[${amount.toFixed(2).replace('.', '')}]_Receipt.jpg`
}

export function sydneyTodayStartIso(): string {
  const key = new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' })
  return `${key}T00:00:00+10:00`
}
