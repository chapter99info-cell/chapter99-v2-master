// PART 8.3 — SMS usage tracking (Super Admin visibility)

import { supabase } from './supabase'

export interface ShopSmsSettings {
  smsEnabled: boolean
  smsPackage: 'none' | 'sms_200' | 'sms_500' | 'sms_unlimited'
}

export interface SmsUsageSnapshot {
  yearMonth: string
  smsCount: number
  smsLimit: number
  pctUsed: number
}

export const SMS_PACKAGE_OPTIONS: {
  value: ShopSmsSettings['smsPackage']
  label: string
  price: string
  limit: number
}[] = [
  { value: 'none', label: 'None', price: '$0', limit: 0 },
  { value: 'sms_200', label: '200 SMS / month', price: '$19/mo', limit: 200 },
  { value: 'sms_500', label: '500 SMS / month', price: '$39/mo', limit: 500 },
  { value: 'sms_unlimited', label: 'Unlimited', price: '$69/mo', limit: 999999 },
]

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function limitForPackage(pkg: string): number {
  const opt = SMS_PACKAGE_OPTIONS.find(o => o.value === pkg)
  return opt?.limit ?? 0
}

export async function fetchShopSmsSettings(shopId: string): Promise<ShopSmsSettings> {
  const { data, error } = await supabase
    .from('shops')
    .select('sms_enabled, sms_package')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) {
    return { smsEnabled: false, smsPackage: 'none' }
  }

  const pkg = String(data.sms_package ?? 'none') as ShopSmsSettings['smsPackage']
  return {
    smsEnabled: data.sms_enabled === true,
    smsPackage: pkg === 'sms_200' || pkg === 'sms_500' || pkg === 'sms_unlimited' ? pkg : 'none',
  }
}

export async function saveShopSmsSettings(
  shopId: string,
  settings: ShopSmsSettings
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update({
      sms_enabled: settings.smsEnabled,
      sms_package: settings.smsEnabled ? settings.smsPackage : 'none',
    })
    .eq('id', shopId)

  if (error) return { ok: false, error: error.message }

  const limit = limitForPackage(settings.smsPackage)
  const ym = currentYearMonth()
  await supabase.from('sms_usage').upsert(
    {
      shop_id: shopId,
      year_month: ym,
      sms_limit: settings.smsEnabled ? limit : 0,
    },
    { onConflict: 'shop_id,year_month' }
  )

  return { ok: true }
}

export async function fetchSmsUsage(shopId: string): Promise<SmsUsageSnapshot> {
  const ym = currentYearMonth()
  const settings = await fetchShopSmsSettings(shopId)

  const { data } = await supabase
    .from('sms_usage')
    .select('sms_count, sms_limit')
    .eq('shop_id', shopId)
    .eq('year_month', ym)
    .maybeSingle()

  const limit = data?.sms_limit ?? limitForPackage(settings.smsPackage)
  const count = data?.sms_count ?? 0

  return {
    yearMonth: ym,
    smsCount: count,
    smsLimit: limit,
    pctUsed: limit > 0 ? Math.round((count / limit) * 1000) / 10 : 0,
  }
}

export async function fetchAllShopsSmsUsage(
  shopIds: string[]
): Promise<Map<string, SmsUsageSnapshot>> {
  const ym = currentYearMonth()
  const { data } = await supabase
    .from('sms_usage')
    .select('shop_id, sms_count, sms_limit')
    .eq('year_month', ym)
    .in('shop_id', shopIds)

  const map = new Map<string, SmsUsageSnapshot>()
  for (const id of shopIds) {
    const row = (data ?? []).find(r => r.shop_id === id)
    map.set(id, {
      yearMonth: ym,
      smsCount: row?.sms_count ?? 0,
      smsLimit: row?.sms_limit ?? 0,
      pctUsed:
        row && row.sms_limit > 0
          ? Math.round((row.sms_count / row.sms_limit) * 1000) / 10
          : 0,
    })
  }
  return map
}
