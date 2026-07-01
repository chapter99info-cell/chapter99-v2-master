// Visual analytics data for Business tier reports

import { supabase } from './supabase'
import { sydneyDayStartUtc, sydneyYmd } from './sydneyTime'

export interface DailyRevenuePoint {
  date: string
  label: string
  revenue: number
}

export interface PaymentMethodBar {
  method: string
  amount: number
}

export interface BookingHeatCell {
  day: number
  hour: number
  count: number
}

export interface ServiceRevenueSlice {
  name: string
  revenue: number
}

export interface StaffRevenueBar {
  name: string
  revenue: number
}

export interface VisualAnalyticsData {
  dailyRevenue30: DailyRevenuePoint[]
  paymentMethodsMonth: PaymentMethodBar[]
  bookingHeatmap: BookingHeatCell[]
  topServices: ServiceRevenueSlice[]
  staffRevenue: StaffRevenueBar[]
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOURS = Array.from({ length: 14 }, (_, i) => i + 10)

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return dt.toISOString().slice(0, 10)
}

function formatLabel(ymd: string): string {
  return new Date(`${ymd}T12:00:00+10:00`).toLocaleDateString('en-AU', {
    timeZone: 'Australia/Sydney',
    day: 'numeric',
    month: 'short',
  })
}

export async function fetchVisualAnalytics(shopId: string): Promise<VisualAnalyticsData> {
  const today = sydneyYmd()
  const start30 = addDaysYmd(today, -29)
  const monthStart = `${today.slice(0, 7)}-01`
  const yearStart = sydneyDayStartUtc(start30).toISOString()
  const monthStartUtc = sydneyDayStartUtc(monthStart).toISOString()

  const [tx30Res, txMonthRes, bookingsRes] = await Promise.all([
    supabase
      .from('transactions')
      .select('paid_at, payment, payment_method, payment_splits, items, therapist_name')
      .eq('shop_id', shopId)
      .eq('status', 'paid')
      .gte('paid_at', yearStart),
    supabase
      .from('transactions')
      .select('payment, payment_method, payment_splits')
      .eq('shop_id', shopId)
      .eq('status', 'paid')
      .gte('paid_at', monthStartUtc),
    supabase
      .from('bookings')
      .select('start_time')
      .eq('shop_id', shopId)
      .neq('status', 'cancelled')
      .gte('start_time', new Date(Date.now() - 90 * 86400000).toISOString()),
  ])

  const dailyMap = new Map<string, number>()
  for (let i = 0; i < 30; i++) {
    dailyMap.set(addDaysYmd(start30, i), 0)
  }
  for (const tx of tx30Res.data ?? []) {
    const ymd = new Date(tx.paid_at as string).toLocaleDateString('en-CA', {
      timeZone: 'Australia/Sydney',
    })
    if (!dailyMap.has(ymd)) continue
    const total = Number((tx.payment as { total?: number })?.total) || 0
    dailyMap.set(ymd, Math.round(((dailyMap.get(ymd) ?? 0) + total) * 100) / 100)
  }
  const dailyRevenue30 = [...dailyMap.entries()].map(([date, revenue]) => ({
    date,
    label: formatLabel(date),
    revenue,
  }))

  const payMap = { cash: 0, card: 0, payid: 0, hicaps: 0, other: 0 }
  for (const tx of txMonthRes.data ?? []) {
    const total = Number((tx.payment as { total?: number })?.total) || 0
    const method = String(tx.payment_method ?? '').toLowerCase()
    if (method === 'cash') payMap.cash += total
    else if (method === 'card' || method === 'amex') payMap.card += total
    else if (method === 'payid') payMap.payid += total
    else if (method === 'hicaps') payMap.hicaps += total
    else payMap.other += total
  }
  const paymentMethodsMonth: PaymentMethodBar[] = [
    { method: 'Cash', amount: Math.round(payMap.cash * 100) / 100 },
    { method: 'Card', amount: Math.round(payMap.card * 100) / 100 },
    { method: 'PayID', amount: Math.round(payMap.payid * 100) / 100 },
    { method: 'HICAPS', amount: Math.round(payMap.hicaps * 100) / 100 },
    { method: 'Other', amount: Math.round(payMap.other * 100) / 100 },
  ].filter(p => p.amount > 0)

  const heatMap = new Map<string, number>()
  for (const b of bookingsRes.data ?? []) {
    const start = new Date(b.start_time as string)
    const parts = new Intl.DateTimeFormat('en-AU', {
      timeZone: 'Australia/Sydney',
      weekday: 'short',
      hour: 'numeric',
      hour12: false,
    }).formatToParts(start)
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Mon'
    const dayIdx = DAY_LABELS.indexOf(weekday)
    const hour = Number(parts.find(p => p.type === 'hour')?.value ?? 12)
    if (dayIdx < 0 || hour < 10 || hour > 23) continue
    const key = `${dayIdx}-${hour}`
    heatMap.set(key, (heatMap.get(key) ?? 0) + 1)
  }
  const bookingHeatmap: BookingHeatCell[] = []
  for (let day = 0; day < 7; day++) {
    for (const hour of HOURS) {
      bookingHeatmap.push({
        day,
        hour,
        count: heatMap.get(`${day}-${hour}`) ?? 0,
      })
    }
  }

  const serviceMap = new Map<string, number>()
  const staffMap = new Map<string, number>()
  for (const tx of txMonthRes.data ?? []) {
    const items = (tx as { items?: { serviceName: string; price: number }[] }).items ?? []
    for (const item of items) {
      const name = item.serviceName?.trim() || 'Other'
      serviceMap.set(name, (serviceMap.get(name) ?? 0) + (Number(item.price) || 0))
    }
    const therapist = (tx as { therapist_name?: string }).therapist_name?.trim() || 'Unassigned'
    const total = Number((tx.payment as { total?: number })?.total) || 0
    staffMap.set(therapist, (staffMap.get(therapist) ?? 0) + total)
  }

  const topServices = [...serviceMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))

  const staffRevenue = [...staffMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, revenue]) => ({ name, revenue: Math.round(revenue * 100) / 100 }))

  return {
    dailyRevenue30,
    paymentMethodsMonth,
    bookingHeatmap,
    topServices,
    staffRevenue,
  }
}
