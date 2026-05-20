// Owner dashboard revenue — Supabase transactions + bookings (Australia/Sydney)

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const SHOP_TZ = 'Australia/Sydney'

export interface PaymentBreakdown {
  cash: number
  card: number
  hicaps: number
}

export interface RevenueStats {
  todayRevenue: number
  monthRevenue: number
  yearRevenue: number
  bookingsToday: number
  paymentBreakdown: PaymentBreakdown
}

/** YYYY-MM-DD in shop timezone */
export function toSydneyDateKey(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TZ }).format(new Date(iso))
}

export function todaySydneyKey(): string {
  return toSydneyDateKey(new Date().toISOString())
}

function parsePaymentTotal(payment: unknown): number {
  if (!payment || typeof payment !== 'object') return 0
  const total = (payment as { total?: number }).total
  return typeof total === 'number' && !Number.isNaN(total) ? total : 0
}

function sydneyDayBounds(dateKey: string): { start: string; end: string } {
  return {
    start: `${dateKey}T00:00:00+10:00`,
    end: `${dateKey}T23:59:59+10:00`,
  }
}

export async function fetchRevenueStats(shopId: string): Promise<RevenueStats> {
  const todayKey = todaySydneyKey()
  const monthPrefix = todayKey.slice(0, 7)
  const yearPrefix = todayKey.slice(0, 4)
  const yearStart = `${yearPrefix}-01-01T00:00:00+10:00`
  const { start: dayStart, end: dayEnd } = sydneyDayBounds(todayKey)

  const [txRes, bookingsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('paid_at, payment, payment_method')
      .eq('shop_id', shopId)
      .eq('status', 'paid')
      .gte('paid_at', yearStart)
      .not('paid_at', 'is', null),
    supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('shop_id', shopId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .neq('status', 'cancelled'),
  ])

  if (txRes.error) throw txRes.error
  if (bookingsRes.error) throw bookingsRes.error

  const stats: RevenueStats = {
    todayRevenue: 0,
    monthRevenue: 0,
    yearRevenue: 0,
    bookingsToday: bookingsRes.count ?? 0,
    paymentBreakdown: { cash: 0, card: 0, hicaps: 0 },
  }

  for (const tx of txRes.data ?? []) {
    if (!tx.paid_at) continue
    const key = toSydneyDateKey(tx.paid_at)
    const total = parsePaymentTotal(tx.payment)

    if (key.startsWith(yearPrefix)) stats.yearRevenue += total
    if (key.slice(0, 7) === monthPrefix) stats.monthRevenue += total
    if (key === todayKey) {
      stats.todayRevenue += total
      const method = (tx.payment_method ?? '').toLowerCase()
      if (method === 'cash') stats.paymentBreakdown.cash += total
      else if (method === 'card' || method === 'amex') stats.paymentBreakdown.card += total
      else if (method === 'hicaps') stats.paymentBreakdown.hicaps += total
    }
  }

  return stats
}
