import { supabase } from './supabase'
import { calcCommission } from './posCalc'
import type { PaymentBreakdown, PaymentSplit } from '../types/pos'

export type ReportPeriod = 'today' | 'week' | 'month'

export interface TherapistPerformanceRow {
  therapistKey: string
  therapistName: string
  sessionCount: number
  totalRevenue: number
  avgSessionValue: number
  commissionEarned: number
}

export interface CommissionReportRow {
  therapistId: string
  therapistName: string
  sessionCount: number
  grossRevenue: number
  commissionRate: number
  commissionOwed: number
}

export interface TransactionExportRow {
  date: string
  transactionId: string
  service: string
  amount: number
  gst: number
  paymentMethod: string
  customer: string
}

interface TxRow {
  id: string
  paid_at: string
  therapist_id: string | null
  therapist_name: string | null
  client_name: string | null
  items: { serviceName: string; price: number }[]
  payment: PaymentBreakdown
  payment_method: string
  payment_splits: PaymentSplit[] | null
}

function sydneyNow(): Date {
  return new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Sydney' }))
}

export function getPeriodBounds(period: ReportPeriod): { start: Date; end: Date } {
  const now = sydneyNow()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  if (period === 'week') {
    const day = start.getDay()
    const diff = day === 0 ? 6 : day - 1
    start.setDate(start.getDate() - diff)
    end.setTime(start.getTime())
    end.setDate(end.getDate() + 7)
  } else if (period === 'month') {
    start.setDate(1)
    end.setMonth(end.getMonth() + 1)
    end.setDate(1)
  }

  return { start, end }
}

export function getMonthBounds(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split('-').map(Number)
  const start = new Date(y, m - 1, 1)
  const end = new Date(y, m, 1)
  return { start, end }
}

async function fetchTransactionsInRange(
  shopId: string,
  start: Date,
  end: Date
): Promise<TxRow[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select(
      'id, paid_at, therapist_id, therapist_name, client_name, items, payment, payment_method, payment_splits'
    )
    .eq('shop_id', shopId)
    .eq('status', 'paid')
    .gte('paid_at', start.toISOString())
    .lt('paid_at', end.toISOString())

  if (error) throw new Error(error.message)
  return (data ?? []) as TxRow[]
}

async function fetchStaffCommissionMap(shopId: string): Promise<Map<string, number>> {
  const { data } = await supabase
    .from('staff')
    .select('id, name_en, commission_rate')
    .eq('shop_id', shopId)
    .eq('active', true)

  const map = new Map<string, number>()
  for (const s of data ?? []) {
    map.set(s.id, Number(s.commission_rate) || 0)
    map.set((s.name_en as string).toLowerCase(), Number(s.commission_rate) || 0)
  }
  return map
}

function txRevenue(tx: TxRow): number {
  return Number(tx.payment?.total ?? 0)
}

function txSubtotal(tx: TxRow): number {
  return Number(tx.payment?.subtotal ?? tx.payment?.total ?? 0)
}

function paymentLabel(tx: TxRow): string {
  if (tx.payment_method === 'split' && tx.payment_splits?.length) {
    return tx.payment_splits.map(s => `${s.method} ${s.amount}`).join(' + ')
  }
  return tx.payment_method
}

export async function fetchTherapistPerformance(
  shopId: string,
  period: ReportPeriod
): Promise<TherapistPerformanceRow[]> {
  const { start, end } = getPeriodBounds(period)
  const [txs, rateMap] = await Promise.all([
    fetchTransactionsInRange(shopId, start, end),
    fetchStaffCommissionMap(shopId),
  ])

  const byTherapist = new Map<string, TherapistPerformanceRow>()

  for (const tx of txs) {
    const name = tx.therapist_name?.trim() || 'Unassigned'
    const key = tx.therapist_id ?? name
    const rev = txRevenue(tx)
    const sub = txSubtotal(tx)
    const rate =
      (tx.therapist_id && rateMap.get(tx.therapist_id)) ||
      rateMap.get(name.toLowerCase()) ||
      0
    const { therapistEarns } = calcCommission(sub, rate)

    const row = byTherapist.get(key) ?? {
      therapistKey: key,
      therapistName: name,
      sessionCount: 0,
      totalRevenue: 0,
      avgSessionValue: 0,
      commissionEarned: 0,
    }
    row.sessionCount += 1
    row.totalRevenue = Math.round((row.totalRevenue + rev) * 100) / 100
    row.commissionEarned = Math.round((row.commissionEarned + therapistEarns) * 100) / 100
    byTherapist.set(key, row)
  }

  return Array.from(byTherapist.values())
    .map(r => ({
      ...r,
      avgSessionValue:
        r.sessionCount > 0
          ? Math.round((r.totalRevenue / r.sessionCount) * 100) / 100
          : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
}

export async function fetchCommissionReport(
  shopId: string,
  monthKey: string
): Promise<CommissionReportRow[]> {
  const { start, end } = getMonthBounds(monthKey)
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name_en, commission_rate, role')
    .eq('shop_id', shopId)
    .eq('active', true)
    .in('role', ['therapist', 'owner'])

  const txs = await fetchTransactionsInRange(shopId, start, end)
  const agg = new Map<string, CommissionReportRow>()

  for (const s of staff ?? []) {
    agg.set(s.id, {
      therapistId: s.id,
      therapistName: s.name_en,
      sessionCount: 0,
      grossRevenue: 0,
      commissionRate: Number(s.commission_rate) || 0,
      commissionOwed: 0,
    })
  }

  for (const tx of txs) {
    const id = tx.therapist_id
    const name = tx.therapist_name?.trim() || 'Unassigned'
    const key = id ?? `name:${name}`
    const sub = txSubtotal(tx)
    const rev = txRevenue(tx)

    let row = id ? agg.get(id) : undefined
    if (!row) {
      const rate =
        (id && agg.get(id)?.commissionRate) ||
        [...agg.values()].find(r => r.therapistName === name)?.commissionRate ||
        0
      row = {
        therapistId: id ?? key,
        therapistName: name,
        sessionCount: 0,
        grossRevenue: 0,
        commissionRate: rate,
        commissionOwed: 0,
      }
      agg.set(key, row)
    }

    const { therapistEarns } = calcCommission(sub, row.commissionRate)
    row.sessionCount += 1
    row.grossRevenue = Math.round((row.grossRevenue + rev) * 100) / 100
    row.commissionOwed = Math.round((row.commissionOwed + therapistEarns) * 100) / 100
  }

  return Array.from(agg.values())
    .filter(r => r.sessionCount > 0 || r.therapistName !== 'Unassigned')
    .sort((a, b) => b.commissionOwed - a.commissionOwed)
}

export async function fetchTransactionsForExport(
  shopId: string,
  start: Date,
  end: Date
): Promise<TransactionExportRow[]> {
  const txs = await fetchTransactionsInRange(shopId, start, end)
  return txs.map(tx => ({
    date: new Date(tx.paid_at).toLocaleString('en-AU', { timeZone: 'Australia/Sydney' }),
    transactionId: tx.id,
    service: (tx.items ?? []).map(i => i.serviceName).join('; '),
    amount: txRevenue(tx),
    gst: Number(tx.payment?.gst ?? 0),
    paymentMethod: paymentLabel(tx),
    customer: tx.client_name ?? '',
  }))
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]): void {
  const escape = (v: string) => {
    if (v.includes(',') || v.includes('"') || v.includes('\n')) {
      return `"${v.replace(/"/g, '""')}"`
    }
    return v
  }
  const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(c => escape(String(c))).join(','))]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportTransactionsCsv(rows: TransactionExportRow[], label: string): void {
  downloadCsv(
    `revenue-${label}.csv`,
    ['date', 'transaction_id', 'service', 'amount', 'GST', 'payment_method', 'customer'],
    rows.map(r => [
      r.date,
      r.transactionId,
      r.service,
      String(r.amount),
      String(r.gst),
      r.paymentMethod,
      r.customer,
    ])
  )
}

export function exportCommissionCsv(rows: CommissionReportRow[], monthKey: string): void {
  downloadCsv(
    `commission-${monthKey}.csv`,
    ['therapist', 'sessions', 'gross_revenue', 'commission_pct', 'commission_owed'],
    rows.map(r => [
      r.therapistName,
      String(r.sessionCount),
      String(r.grossRevenue),
      String(Math.round(r.commissionRate * 100)),
      String(r.commissionOwed),
    ])
  )
}
