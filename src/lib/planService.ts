import { supabase } from './supabase'
import {
  normalizeShopPlan,
  type ShopPlan,
  type ShopPlanAddons,
  type ShopPlanState,
} from '../types/plan'

export interface ShopPlanSettings extends ShopPlanState {
  shopId: string
}

const PLAN_COLUMNS =
  'id, plan, addon_stripe, addon_sms, addon_website, addon_reports'

export function rowToPlanState(row: Record<string, unknown>): ShopPlanState {
  return {
    plan: normalizeShopPlan(row.plan as string),
    addonStripe: row.addon_stripe === true,
    addonSms: row.addon_sms === true,
    addonWebsite: row.addon_website === true,
    addonReports: row.addon_reports === true,
  }
}

export async function fetchShopPlanState(shopId: string): Promise<ShopPlanState> {
  const { data, error } = await supabase
    .from('shops')
    .select(PLAN_COLUMNS)
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) {
    return {
      plan: 'starter',
      addonStripe: false,
      addonSms: false,
      addonWebsite: false,
      addonReports: false,
    }
  }
  return rowToPlanState(data as Record<string, unknown>)
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
}): ShopPlanState {
  return {
    plan: normalizeShopPlan(shop.plan),
    addonStripe: shop.addonStripe ?? false,
    addonSms: shop.addonSms ?? false,
    addonWebsite: shop.addonWebsite ?? false,
    addonReports: shop.addonReports ?? false,
  }
}
