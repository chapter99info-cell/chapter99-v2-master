import { supabase } from './supabase'
import {
  normalizeShopPlan,
  type ShopPlan,
  type ShopPlanAddons,
  type ShopPlanState,
} from '../types/plan'
import { parseFeatureOverrides } from './shopFeatureAccess'

export interface ShopPlanSettings extends ShopPlanState {
  shopId: string
}

const PLAN_COLUMNS =
  'id, plan, addon_stripe, addon_sms, addon_website, addon_reports, feature_overrides, sms_enabled, sms_package'

const DEFAULT_PLAN_STATE: ShopPlanState = {
  plan: 'starter',
  addonStripe: false,
  addonSms: false,
  addonWebsite: false,
  addonReports: false,
  featureOverrides: {},
  smsEnabled: false,
  smsPackage: 'none',
}

export function rowToPlanState(row: Record<string, unknown>): ShopPlanState {
  const smsPackage = String(row.sms_package ?? 'none')
  return {
    plan: normalizeShopPlan(row.plan as string),
    addonStripe: row.addon_stripe === true,
    addonSms: row.addon_sms === true,
    addonWebsite: row.addon_website === true,
    addonReports: row.addon_reports === true,
    featureOverrides: parseFeatureOverrides(row.feature_overrides),
    smsEnabled: row.sms_enabled === true,
    smsPackage:
      smsPackage === 'sms_200' || smsPackage === 'sms_500' || smsPackage === 'sms_unlimited'
        ? smsPackage
        : 'none',
  }
}

export interface FetchShopPlanResult {
  state: ShopPlanState
  error?: string
}

export async function fetchShopPlanStateResult(shopId: string): Promise<FetchShopPlanResult> {
  const { data, error } = await supabase
    .from('shops')
    .select(PLAN_COLUMNS)
    .eq('id', shopId)
    .maybeSingle()

  if (error) {
    if (import.meta.env.DEV) {
      console.error('[planService] fetchShopPlanState', error)
    }
    return { state: { ...DEFAULT_PLAN_STATE }, error: error.message }
  }
  if (!data) {
    return { state: { ...DEFAULT_PLAN_STATE }, error: 'Shop not found' }
  }
  return { state: rowToPlanState(data as Record<string, unknown>) }
}

export async function fetchShopPlanState(shopId: string): Promise<ShopPlanState> {
  const result = await fetchShopPlanStateResult(shopId)
  return result.state
}

export async function fetchShopPlanSettings(shopId: string): Promise<ShopPlanSettings> {
  const state = await fetchShopPlanState(shopId)
  return { shopId, ...state }
}

export async function saveShopPlanSettings(
  settings: ShopPlanSettings
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update({
      plan: settings.plan,
      addon_stripe: settings.addonStripe,
      addon_sms: settings.addonSms,
      addon_website: settings.addonWebsite,
      addon_reports: settings.addonReports,
    })
    .eq('id', settings.shopId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export function planStateFromShop(shop: {
  plan?: string
  addonStripe?: boolean
  addonSms?: boolean
  addonWebsite?: boolean
  addonReports?: boolean
  featureOverrides?: Record<string, boolean>
  smsEnabled?: boolean
  smsPackage?: string | null
}): ShopPlanState {
  return {
    plan: normalizeShopPlan(shop.plan),
    addonStripe: shop.addonStripe ?? false,
    addonSms: shop.addonSms ?? false,
    addonWebsite: shop.addonWebsite ?? false,
    addonReports: shop.addonReports ?? false,
    featureOverrides: shop.featureOverrides ?? {},
    smsEnabled: shop.smsEnabled ?? false,
    smsPackage: shop.smsPackage ?? 'none',
  }
}
