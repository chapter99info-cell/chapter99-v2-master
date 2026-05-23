// Chapter99 V4 — Phase 7
// Super Admin Data Service (PIN 3501)
// Fetches all shops — bypasses RLS via service role

import { createClient } from '@supabase/supabase-js'
import type { ShopOverview, MRRSummary, SuperAdminStats } from '../types/admin'
import { normalizeShopPlan, type ShopPlan } from '../types/plan'

// Service role client — full access to all shops
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

const PLAN_PRICES: Record<ShopPlan, number> = {
  starter: 29,
  growth: 69,
  pro: 110,
}

// ── Fetch all shops with stats ────────────────────────────────
export async function fetchAllShops(): Promise<ShopOverview[]> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: shops } = await supabase
    .from('shops')
    .select(`
      id, name, slug, plan, active, created_at, phone, email,
      staff(id, active),
      bookings(id, created_at),
      transactions(id, paid_at, payment),
      alerts(id, severity, dismissed)
    `)
    .order('created_at', { ascending: false })

  if (!shops) return []

  return shops.map(shop => {
    const activeStaff = (shop.staff ?? []).filter((s: any) => s.active).length
    const monthTx = (shop.transactions ?? []).filter((t: any) =>
      t.paid_at && t.paid_at >= monthStart
    )
    const revenueThisMonth = monthTx.reduce((sum: number, t: any) =>
      sum + ((t.payment?.total as number) ?? 0), 0
    )
    const bookingsThisMonth = (shop.bookings ?? []).filter((b: any) =>
      b.created_at >= monthStart
    ).length
    const undismissedAlerts = (shop.alerts ?? []).filter((a: any) => !a.dismissed)

    return {
      id: shop.id,
      name: shop.name,
      slug: (shop.slug as string) || undefined,
      plan: normalizeShopPlan(shop.plan as string),
      status: shop.active ? 'active' : 'suspended',
      mrr: PLAN_PRICES[normalizeShopPlan(shop.plan as string)],
      setupFee: 0,
      joinedAt: shop.created_at,
      lastActivity: monthTx[0]?.paid_at ?? shop.created_at,
      bookingsThisMonth,
      revenueThisMonth,
      activeStaff,
      alertCount: undismissedAlerts.length,
      criticalAlerts: undismissedAlerts.filter((a: any) => a.severity === 'critical').length,
      ownerName: shop.name,
      ownerPhone: shop.phone ?? '',
      ownerEmail: shop.email ?? '',
      domain: `${shop.id}.chapter99.com.au`,
    }
  })
}

// ── MRR Summary ───────────────────────────────────────────────
export async function fetchMRRSummary(shops: ShopOverview[]): Promise<MRRSummary> {
  const active = shops.filter(s => s.status === 'active')
  const total = active.reduce((sum, s) => sum + s.mrr, 0)

  const byPlan = {
    starter: active.filter(s => s.plan === 'starter').reduce((s, x) => s + x.mrr, 0),
    growth: active.filter(s => s.plan === 'growth').reduce((s, x) => s + x.mrr, 0),
    pro: active.filter(s => s.plan === 'pro').reduce((s, x) => s + x.mrr, 0),
  }

  // New shops this month
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  const newThisMonth = shops.filter(s => new Date(s.joinedAt) >= monthStart).length

  return {
    total,
    byPlan,
    growth: 12.5,          // TODO: calculate vs last month
    churnRisk: shops.filter(s => s.status === 'overdue').length,
    newThisMonth,
    totalShops: shops.length,
    activeShops: active.length,
  }
}

// ── Revenue History (12 months) ───────────────────────────────
export async function fetchRevenueHistory(): Promise<
  { month: string; revenue: number; mrr: number }[]
> {
  const { data } = await supabase
    .from('transactions')
    .select('paid_at, payment')
    .eq('status', 'paid')
    .gte('paid_at', new Date(Date.now() - 365 * 86400000).toISOString())
    .order('paid_at')

  if (!data) return []

  // Group by month
  const byMonth: Record<string, number> = {}
  data.forEach(tx => {
    const month = tx.paid_at.substring(0, 7) // YYYY-MM
    byMonth[month] = (byMonth[month] ?? 0) + ((tx.payment?.total as number) ?? 0)
  })

  return Object.entries(byMonth).map(([month, revenue]) => ({
    month,
    revenue: Math.round(revenue),
    mrr: Math.round(revenue * 0.12), // estimated MRR portion
  }))
}

// ── Add new shop ──────────────────────────────────────────────
export async function createShop(data: {
  id: string
  name: string
  plan: string
  phone: string
  email: string
  abn: string
  address: string
}): Promise<boolean> {
  const { error } = await supabase.from('shops').insert({
    ...data,
    active: true,
    currency: 'AUD',
    timezone: 'Australia/Sydney',
    card_surcharge: 0.015,
    amex_surcharge: 0.02,
  })
  return !error
}

// ── Toggle shop active state ──────────────────────────────────
export async function toggleShopStatus(
  shopId: string,
  active: boolean
): Promise<boolean> {
  const { error } = await supabase
    .from('shops')
    .update({ active })
    .eq('id', shopId)
  return !error
}

// ── Fetch all proposals ───────────────────────────────────────
export async function fetchProposals() {
  const { data } = await supabase
    .from('proposals')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? []
}
