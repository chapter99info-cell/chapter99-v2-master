/**
 * Per-shop feature overrides — checked before plan tier matrix.
 * Super Admin writes shops.feature_overrides (JSONB); no redeploy needed.
 */

import {
  canAccessFeature as canAccessTierFeature,
  normalizeFeatureTier,
  type FeatureKey,
  type FeatureTier,
} from './featureGate'
import {
  normalizeShopPlan,
  PLAN_LABELS,
  PLAN_TIER_FEATURES,
  type PlanFeature,
  type ShopPlan,
  type ShopPlanAddons,
} from '../types/plan'

/** Keys stored in shops.feature_overrides */
export const FEATURE_OVERRIDE_IDS = [
  'pos',
  'health_fund_receipt',
  'multi_room',
  'booking_online',
  'sms_alerts',
  'gift_vouchers',
  'sms_200',
  'sms_500',
  'sms_unlimited',
  'google_business_mgmt',
  'social_media_mgmt',
  'seo_local_pack',
  'ai_content_monthly',
  'extra_branch',
  'priority_support',
] as const

export type FeatureOverrideId = (typeof FEATURE_OVERRIDE_IDS)[number]

export const FEATURE_OVERRIDE_LABELS: Record<FeatureOverrideId, string> = {
  pos: 'POS',
  health_fund_receipt: 'Health Fund Receipt',
  multi_room: 'Multi-room',
  booking_online: 'Booking Online',
  sms_alerts: 'SMS Alerts',
  gift_vouchers: 'Gift Vouchers',
  sms_200: 'SMS Extra 200',
  sms_500: 'SMS Extra 500',
  sms_unlimited: 'SMS Unlimited',
  google_business_mgmt: 'Google Business Mgmt',
  social_media_mgmt: 'Social Media Mgmt',
  seo_local_pack: 'SEO Local Pack',
  ai_content_monthly: 'AI Content Monthly',
  extra_branch: 'Extra Branch / Location',
  priority_support: 'Priority Support',
}

const FEATURE_KEY_TO_OVERRIDE: Partial<Record<FeatureKey, FeatureOverrideId>> = {
  pos: 'pos',
  health_fund_receipt: 'health_fund_receipt',
  multi_room: 'multi_room',
  booking_online: 'booking_online',
  gift_vouchers: 'gift_vouchers',
}

/** Map legacy FeatureKey → billing plan feature (starter/growth/pro). */
const FEATURE_KEY_TO_PLAN: Partial<Record<FeatureKey, PlanFeature>> = {
  booking_online: 'booking',
  gift_vouchers: 'gift_vouchers',
  pos: 'pos',
  staff_management: 'staff',
  advanced_reports: 'reports',
  online_deposit: 'stripe',
}

const PLAN_FEATURE_TO_OVERRIDE: Partial<Record<PlanFeature, FeatureOverrideId>> = {
  booking: 'booking_online',
  queue: 'booking_online',
  pos: 'pos',
  gift_vouchers: 'gift_vouchers',
  sms: 'sms_alerts',
  multi_shop: 'extra_branch',
}

export interface ShopFeatureContext extends ShopPlanAddons {
  plan: string
  featureOverrides?: Record<string, boolean> | null
  smsEnabled?: boolean
  smsPackage?: string | null
}

export function parseFeatureOverrides(raw: unknown): Record<string, boolean> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Record<string, boolean> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'boolean') out[key] = value
  }
  return out
}

/** Base plan tier + add-ons — does not read feature_overrides (avoids recursion). */
function planTierIncludes(
  shopPlan: ShopPlan,
  feature: PlanFeature,
  addons: ShopPlanAddons
): boolean {
  if (PLAN_TIER_FEATURES[shopPlan].includes(feature)) return true
  if (feature === 'stripe' && addons.addonStripe) return true
  if (feature === 'sms' && addons.addonSms) return true
  if (feature === 'website_builder' && addons.addonWebsite) return true
  if (feature === 'reports' && addons.addonReports) return true
  return false
}

export function getFeatureOverride(
  context: ShopFeatureContext,
  id: FeatureOverrideId
): boolean | undefined {
  const overrides = context.featureOverrides
  if (!overrides || !(id in overrides)) return undefined
  return overrides[id]
}

/** Plan/add-on default before overrides */
export function planDefaultForFeature(
  context: ShopFeatureContext,
  id: FeatureOverrideId
): boolean {
  const tier = normalizeFeatureTier(context.plan)
  const shopPlan = normalizeShopPlan(context.plan)
  const planState = {
    plan: shopPlan,
    addonStripe: context.addonStripe ?? false,
    addonSms: context.addonSms ?? false,
    addonWebsite: context.addonWebsite ?? false,
    addonReports: context.addonReports ?? false,
  }

  switch (id) {
    case 'pos':
      return planTierIncludes(shopPlan, 'pos', planState)
    case 'health_fund_receipt':
      return (
        canAccessTierFeature(tier, 'health_fund_receipt') ||
        planTierIncludes(shopPlan, 'pos', planState)
      )
    case 'multi_room':
      return canAccessTierFeature(tier, 'multi_room')
    case 'booking_online':
      return planTierIncludes(shopPlan, 'booking', planState)
    case 'gift_vouchers':
      return planTierIncludes(shopPlan, 'gift_vouchers', planState)
    case 'sms_alerts':
      return context.smsEnabled === true || context.addonSms === true
    case 'sms_200':
      return context.smsEnabled === true && context.smsPackage === 'sms_200'
    case 'sms_500':
      return context.smsEnabled === true && context.smsPackage === 'sms_500'
    case 'sms_unlimited':
      return context.smsEnabled === true && context.smsPackage === 'sms_unlimited'
    case 'google_business_mgmt':
    case 'social_media_mgmt':
    case 'seo_local_pack':
    case 'ai_content_monthly':
    case 'extra_branch':
    case 'priority_support':
      return false
    default:
      return false
  }
}

/** Primary gate: override → plan default */
export function hasFeature(
  context: ShopFeatureContext,
  id: FeatureOverrideId
): boolean {
  const override = getFeatureOverride(context, id)
  if (override !== undefined) return override
  return planDefaultForFeature(context, id)
}

export function hasFeatureKey(
  context: ShopFeatureContext,
  feature: FeatureKey
): boolean {
  const overrideId = FEATURE_KEY_TO_OVERRIDE[feature]
  if (overrideId) return hasFeature(context, overrideId)
  const planFeature = FEATURE_KEY_TO_PLAN[feature]
  if (planFeature) return hasPlanFeature(context, planFeature)
  const tier = normalizeFeatureTier(context.plan)
  return canAccessTierFeature(tier, feature)
}

export function hasPlanFeature(
  context: ShopFeatureContext,
  feature: PlanFeature
): boolean {
  const overrideId = PLAN_FEATURE_TO_OVERRIDE[feature]
  if (overrideId) return hasFeature(context, overrideId)

  const shopPlan = normalizeShopPlan(context.plan)
  const addons: ShopPlanAddons = {
    addonStripe: context.addonStripe ?? false,
    addonSms: context.addonSms ?? false,
    addonWebsite: context.addonWebsite ?? false,
    addonReports: context.addonReports ?? false,
  }

  return planTierIncludes(shopPlan, feature, addons)
}

export function shopFeatureContextFromPlanState(state: {
  plan: ShopPlan
  addonStripe: boolean
  addonSms: boolean
  addonWebsite: boolean
  addonReports: boolean
  featureOverrides?: Record<string, boolean>
  smsEnabled?: boolean
  smsPackage?: string | null
}): ShopFeatureContext {
  return {
    plan: state.plan,
    addonStripe: state.addonStripe,
    addonSms: state.addonSms,
    addonWebsite: state.addonWebsite,
    addonReports: state.addonReports,
    featureOverrides: state.featureOverrides,
    smsEnabled: state.smsEnabled,
    smsPackage: state.smsPackage,
  }
}

export function isFeatureOverrideId(value: string): value is FeatureOverrideId {
  return (FEATURE_OVERRIDE_IDS as readonly string[]).includes(value)
}

export function tierLabelForPlan(plan: string): string {
  return PLAN_LABELS[normalizeShopPlan(plan)]
}
