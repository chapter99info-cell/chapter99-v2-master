import { supabase } from './supabase'
import {
  defaultDepositSettings,
  depositSettingsToRow,
  rowToDepositSettings,
  type DepositMonthStats,
  type ShopDepositSettings,
} from '../types/shopDeposit'

const DEPOSIT_COLUMNS =
  'id, deposit_enabled, deposit_type, deposit_percent, deposit_fixed_amount, deposit_refund_hours, addon_stripe, stripe_pub_key'

function sydneyMonthBounds(): { start: string; end: string; label: string } {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find(p => p.type === 'year')?.value ?? '2026'
  const month = parts.find(p => p.type === 'month')?.value ?? '01'
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)
  const nextM = m === 12 ? 1 : m + 1
  const nextY = m === 12 ? y + 1 : y
  const start = `${year}-${month}-01T00:00:00+10:00`
  const end = `${String(nextY).padStart(4, '0')}-${String(nextM).padStart(2, '0')}-01T00:00:00+10:00`
  const label = new Date(`${year}-${month}-15T12:00:00+10:00`).toLocaleDateString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Australia/Sydney',
  })
  return { start, end, label }
}

export async function fetchShopDepositSettings(
  shopId: string
): Promise<ShopDepositSettings> {
  const { data, error } = await supabase
    .from('shops')
    .select(DEPOSIT_COLUMNS)
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) return defaultDepositSettings(shopId)
  return rowToDepositSettings(data as Record<string, unknown>)
}

export async function saveShopDepositSettings(
  settings: ShopDepositSettings
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update(depositSettingsToRow(settings))
    .eq('id', settings.shopId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function fetchDepositMonthStats(shopId: string): Promise<{
  stats: DepositMonthStats
  monthLabel: string
}> {
  const { start, end, label } = sydneyMonthBounds()

  const [collectedRes, pendingRes, refundsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('deposit_amount')
      .eq('shop_id', shopId)
      .eq('deposit_paid', true)
      .gte('deposit_paid_at', start)
      .lt('deposit_paid_at', end),
    supabase
      .from('bookings')
      .select('deposit_amount')
      .eq('shop_id', shopId)
      .eq('status', 'pending_deposit'),
    supabase
      .from('bookings')
      .select('deposit_amount')
      .eq('shop_id', shopId)
      .eq('deposit_refunded', true)
      .gte('deposit_refunded_at', start)
      .lt('deposit_refunded_at', end),
  ])

  const sum = (rows: { deposit_amount: number | null }[] | null) =>
    (rows ?? []).reduce((t, r) => t + Number(r.deposit_amount ?? 0), 0)

  return {
    monthLabel: label,
    stats: {
      collected: sum(collectedRes.data as { deposit_amount: number | null }[] | null),
      pending: sum(pendingRes.data as { deposit_amount: number | null }[] | null),
      refunds: sum(refundsRes.data as { deposit_amount: number | null }[] | null),
    },
  }
}
