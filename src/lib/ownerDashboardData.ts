import { getAllLocalExpenses } from './expenseDb'
import { mergeBookingsForOwner } from './staffPortalStorage'
import { filterAllowedTours, filterBookingsForAllowedTours } from './tripFilters'
import { supabase } from './supabase'
import type { Expense, Tour, TourBooking, TourStatus } from '../types/tour'

const PAID_STATUSES = new Set(['FULLY_PAID', 'DEPOSIT_PAID'])

export interface OwnerDashboardData {
  tours: Tour[]
  bookings: TourBooking[]
  expenses: Expense[]
}

export interface MonthlyRevenue {
  label: string
  amount: number
}

export interface OwnerKpiMetrics {
  ytdRevenue: number
  ytdExpenses: number
  netProfit: number
  gstCollected: number
  gstClaimed: number
  activeTours: number
  monthlyRevenue: MonthlyRevenue[]
}

function sydneyYear(d: Date): number {
  return Number(d.toLocaleDateString('en-CA', { timeZone: 'Australia/Sydney' }).slice(0, 4))
}

function parseCreatedAt(iso: string): Date {
  return new Date(iso)
}

function isYtd(iso: string, year: number): boolean {
  return sydneyYear(parseCreatedAt(iso)) === year
}

function mergeExpenses(remote: Expense[], local: Expense[]): Expense[] {
  const byId = new Map<string, Expense>()
  for (const e of remote) byId.set(e.id, e)
  for (const e of local) {
    if (!byId.has(e.id)) byId.set(e.id, e)
  }
  return Array.from(byId.values()).sort(
    (a, b) => parseCreatedAt(b.created_at).getTime() - parseCreatedAt(a.created_at).getTime()
  )
}

export async function fetchOwnerDashboardData(): Promise<OwnerDashboardData> {
  const [toursRes, bookingsRes, expensesRes] = await Promise.all([
    supabase.from('tours').select('*'),
    supabase.from('tour_bookings').select('*'),
    supabase.from('expenses').select('*'),
  ])

  const firstError = toursRes.error ?? bookingsRes.error ?? expensesRes.error
  if (firstError) throw new Error(firstError.message)

  let localExpenses: Expense[] = []
  try {
    localExpenses = await getAllLocalExpenses()
  } catch {
    localExpenses = []
  }

  const allTours = (toursRes.data ?? []) as Tour[]
  const tours = filterAllowedTours(allTours)
  const remoteBookings = filterBookingsForAllowedTours(
    (bookingsRes.data ?? []) as TourBooking[],
    allTours
  )

  return {
    tours,
    bookings: mergeBookingsForOwner(remoteBookings),
    expenses: mergeExpenses((expensesRes.data ?? []) as Expense[], localExpenses),
  }
}

export function tourRevenue(tourId: string, bookings: TourBooking[]): number {
  return bookings
    .filter((b) => b.tour_id === tourId && PAID_STATUSES.has(b.booking_status))
    .reduce((s, b) => s + Number(b.amount_paid_aud ?? 0), 0)
}

export function computeOwnerKpis(
  tours: Tour[],
  bookings: TourBooking[],
  expenses: Expense[]
): OwnerKpiMetrics {
  const year = sydneyYear(new Date())

  const ytdBookings = bookings.filter(
    (b) => PAID_STATUSES.has(b.booking_status) && b.created_at && isYtd(b.created_at, year)
  )
  const ytdRevenue = ytdBookings.reduce((s, b) => s + Number(b.amount_paid_aud ?? 0), 0)
  const ytdExpenses = expenses
    .filter((e) => isYtd(e.created_at, year))
    .reduce((s, e) => s + e.amount_aud, 0)
  const gstClaimed = expenses
    .filter((e) => isYtd(e.created_at, year))
    .reduce((s, e) => s + e.gst_amount_aud, 0)

  const monthlyRevenue: MonthlyRevenue[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-AU', { month: 'short', timeZone: 'Australia/Sydney' })
    const amount = bookings
      .filter((b) => {
        if (!PAID_STATUSES.has(b.booking_status) || !b.created_at) return false
        const key = parseCreatedAt(b.created_at).toISOString().slice(0, 7)
        return key === monthKey
      })
      .reduce((s, b) => s + Number(b.amount_paid_aud ?? 0), 0)
    monthlyRevenue.push({ label, amount })
  }

  const activeStatuses: TourStatus[] = ['CONFIRMED', 'ACTIVE']
  const activeTours = tours.filter((t) => activeStatuses.includes(t.status)).length

  return {
    ytdRevenue,
    ytdExpenses,
    netProfit: ytdRevenue - ytdExpenses,
    gstCollected: ytdRevenue / 11,
    gstClaimed,
    activeTours,
    monthlyRevenue,
  }
}

export const OWNER_TABLE_COUNTS = [
  'tours',
  'tour_bookings',
  'crm_clients',
  'expenses',
  'staff_commission_ledger',
  'staff_profiles',
  'client_guide_content',
  'gallery',
] as const

export type OwnerTableName = (typeof OWNER_TABLE_COUNTS)[number]

export async function fetchTableCounts(): Promise<Record<OwnerTableName, number | null>> {
  const entries = await Promise.all(
    OWNER_TABLE_COUNTS.map(async (table) => {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
      return [table, error ? null : (count ?? 0)] as const
    })
  )
  return Object.fromEntries(entries) as Record<OwnerTableName, number | null>
}
