/**
 * Central SMS gateway — enforces sms_enabled, quota, priority, and usage tracking.
 * All Twilio sends must go through sendShopSms().
 */
import twilio from 'twilio'
import { getServiceSupabase } from './supabaseServer'

export type SmsPriority = 'critical' | 'normal' | 'low'

/** Priority order — never cut critical (booking confirm/reminder) */
const PRIORITY_RANK: Record<SmsPriority, number> = {
  critical: 3,
  normal: 2,
  low: 1,
}

export interface ShopSmsConfig {
  sms_enabled: boolean
  sms_package: string
}

export interface SmsUsageRow {
  sms_count: number
  sms_limit: number
}

export function smsLimitForPackage(pkg: string): number {
  switch (pkg) {
    case 'sms_200':
      return 200
    case 'sms_500':
      return 500
    case 'sms_unlimited':
      return 999999
    default:
      return 0
  }
}

function currentYearMonth(): string {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function formatAuSmsTo(to: string): string {
  const digits = to.replace(/\D/g, '')
  if (to.startsWith('+')) return to
  if (digits.startsWith('61')) return `+${digits}`
  if (digits.startsWith('0')) return `+61${digits.slice(1)}`
  return `+61${digits}`
}

export async function fetchShopSmsConfig(shopId: string): Promise<ShopSmsConfig | null> {
  const sb = getServiceSupabase()
  const { data, error } = await sb
    .from('shops')
    .select('sms_enabled, sms_package')
    .eq('id', shopId)
    .maybeSingle()
  if (error || !data) return null
  return {
    sms_enabled: data.sms_enabled === true,
    sms_package: String(data.sms_package ?? 'none'),
  }
}

export async function getSmsUsage(shopId: string): Promise<SmsUsageRow> {
  const ym = currentYearMonth()
  const sb = getServiceSupabase()
  const { data } = await sb
    .from('sms_usage')
    .select('sms_count, sms_limit')
    .eq('shop_id', shopId)
    .eq('year_month', ym)
    .maybeSingle()

  if (data) {
    return { sms_count: data.sms_count ?? 0, sms_limit: data.sms_limit ?? 0 }
  }

  const config = await fetchShopSmsConfig(shopId)
  const limit = config ? smsLimitForPackage(config.sms_package) : 0
  return { sms_count: 0, sms_limit: limit }
}

async function ensureUsageRow(shopId: string, limit: number): Promise<void> {
  const ym = currentYearMonth()
  const sb = getServiceSupabase()
  await sb.from('sms_usage').upsert(
    { shop_id: shopId, year_month: ym, sms_count: 0, sms_limit: limit },
    { onConflict: 'shop_id,year_month', ignoreDuplicates: true }
  )
}

async function incrementSmsCount(shopId: string): Promise<number> {
  const ym = currentYearMonth()
  const sb = getServiceSupabase()
  const usage = await getSmsUsage(shopId)
  const next = usage.sms_count + 1
  await sb.from('sms_usage').upsert({
    shop_id: shopId,
    year_month: ym,
    sms_count: next,
    sms_limit: usage.sms_limit,
  })
  return next
}

/** Returns true if Super Admin should be alerted (80%+ quota) */
export async function checkSmsQuotaAlert(shopId: string): Promise<boolean> {
  const usage = await getSmsUsage(shopId)
  if (usage.sms_limit <= 0) return false
  return usage.sms_count / usage.sms_limit >= 0.8
}

export interface SendShopSmsInput {
  shopId: string
  to: string
  message: string
  priority?: SmsPriority
}

export interface SendShopSmsResult {
  sent: boolean
  skipped: boolean
  reason?: string
  sid?: string
}

/**
 * Send SMS for a shop. Skips silently when disabled, over quota (low priority), or misconfigured.
 */
export async function sendShopSms(input: SendShopSmsInput): Promise<SendShopSmsResult> {
  const priority = input.priority ?? 'normal'
  const config = await fetchShopSmsConfig(input.shopId)

  if (!config?.sms_enabled) {
    return { sent: false, skipped: true, reason: 'sms_disabled' }
  }

  const limit = smsLimitForPackage(config.sms_package)
  if (limit <= 0) {
    return { sent: false, skipped: true, reason: 'no_sms_package' }
  }

  await ensureUsageRow(input.shopId, limit)
  const usage = await getSmsUsage(input.shopId)

  if (usage.sms_count >= usage.sms_limit) {
    if (priority === 'critical') {
      // Never cut booking confirm/reminder — still send but log overage
      console.warn(`[sms] shop ${input.shopId} over quota but critical SMS allowed`)
    } else if (priority === 'normal' && usage.sms_count >= usage.sms_limit) {
      return { sent: false, skipped: true, reason: 'quota_exceeded' }
    } else if (priority === 'low') {
      return { sent: false, skipped: true, reason: 'quota_exceeded_low_priority' }
    }
  }

  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  const from = process.env.TWILIO_FROM_NUMBER
  if (!sid || !token || !from) {
    return { sent: false, skipped: true, reason: 'twilio_not_configured' }
  }

  try {
    const client = twilio(sid, token)
    const msg = await client.messages.create({
      body: input.message,
      from,
      to: formatAuSmsTo(input.to),
    })
    await incrementSmsCount(input.shopId)
    if (await checkSmsQuotaAlert(input.shopId)) {
      console.warn(`[sms] shop ${input.shopId} at 80%+ SMS quota`)
    }
    return { sent: true, skipped: false, sid: msg.sid }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'sms_failed'
    console.error('[sms]', reason)
    return { sent: false, skipped: false, reason }
  }
}
