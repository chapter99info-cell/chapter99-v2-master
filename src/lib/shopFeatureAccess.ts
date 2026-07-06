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

/** Staff-app / FeatureGate keys stored in shops.feature_overrides */
export const STAFF_FEATURE_OVERRIDE_IDS = [
  'pos',
  'health_fund_receipt',
  'multi_room',
  'booking_online',
  'gift_vouchers',
  'staff_management',
  'advanced_reports',
  'online_deposit',
  'landing_page',
  'ai_images',
  'edit_price_self_service',
  'real_photography_upsell',
  'website_builder',
  'multi_shop',
] as const

/** Billing / marketing add-ons (Super Admin only) */
export const BILLING_FEATURE_OVERRIDE_IDS = [
  'sms_alerts',
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

/** Keys stored in shops.feature_overrides */
export const FEATURE_OVERRIDE_IDS = [
  ...STAFF_FEATURE_OVERRIDE_IDS,
  ...BILLING_FEATURE_OVERRIDE_IDS,
] as const

export type FeatureOverrideId = (typeof FEATURE_OVERRIDE_IDS)[number]

export const FEATURE_OVERRIDE_LABELS: Record<FeatureOverrideId, string> = {
  pos: 'POS',
  health_fund_receipt: 'Health Fund Receipt',
  multi_room: 'Multi-room',
  booking_online: 'Booking Online',
  gift_vouchers: 'Gift Vouchers',
  staff_management: 'Staff Management',
  advanced_reports: 'Advanced Reports',
  online_deposit: 'Online Deposit',
  landing_page: 'Landing Page',
  ai_images: 'AI Images',
  edit_price_self_service: 'Self-service Price Edits',
  real_photography_upsell: 'Real Photography',
  website_builder: 'Website Builder',
  multi_shop: 'Multi-shop',
  sms_alerts: 'SMS Alerts',
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

export const FEATURE_OVERRIDE_LABELS_TH: Partial<Record<FeatureOverrideId, string>> = {
  pos: 'ระบบ POS',
  health_fund_receipt: 'ใบเสร็จ Health Fund',
  multi_room: 'จัดการห้อง/เตียง',
  booking_online: 'จองออนไลน์',
  gift_vouchers: 'บัตรของขวัญ',
  staff_management: 'จัดการพนักงาน',
  advanced_reports: 'รายงานขั้นสูง',
  online_deposit: 'มัดจำออนไลน์',
  landing_page: 'หน้าเว็บร้าน',
  ai_images: 'รูป AI',
  edit_price_self_service: 'แก้ราคาเอง',
  real_photography_upsell: 'ถ่ายภาพจริง',
  website_builder: 'Website Builder',
  multi_shop: 'หลายสาขา',
  sms_alerts: 'แจ้งเตือน SMS',
}

export const FEATURE_TOGGLE_GROUPS: {
  title: string
  titleTh: string
  ids: readonly FeatureOverrideId[]
}[] = [
  {
    title: 'Staff dashboard tabs',
    titleTh: 'แท็บแดชบอร์ดพนักงาน',
    ids: STAFF_FEATURE_OVERRIDE_IDS,
  },
  {
    title: 'Billing & add-ons',
    titleTh: 'แพ็กเกจเสริม / Add-ons',
    ids: BILLING_FEATURE_OVERRIDE_IDS,
  },
]

const FEATURE_KEY_TO_OVERRIDE: Partial<Record<FeatureKey, FeatureOverrideId>> = {
  pos: 'pos',
  health_fund_receipt: 'health_fund_receipt',
  multi_room: 'multi_room',
  booking_online: 'booking_online',
  gift_vouchers: 'gift_vouchers',
  staff_management: 'staff_management',
  advanced_reports: 'advanced_reports',
  online_deposit: 'online_deposit',
  landing_page: 'landing_page',
  ai_images: 'ai_images',
  edit_price_self_service: 'edit_price_self_service',
  real_photography_upsell: 'real_photography_upsell',
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
  staff: 'staff_management',
  gift_vouchers: 'gift_vouchers',
  reports: 'advanced_reports',
  customer_history: 'advanced_reports',
  website_builder: 'website_builder',
  multi_shop: 'multi_shop',
  stripe: 'online_deposit',
  sms: 'sms_alerts',
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

function tierDefaultForOverrideId(
  id: FeatureOverrideId,
  tier: FeatureTier,
  shopPlan: ShopPlan,
  planState: ShopPlanAddons & { plan: ShopPlan },
  context: ShopFeatureContext
): boolean {
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
    case 'staff_management':
      return (
        canAccessTierFeature(tier, 'staff_management') ||
        planTierIncludes(shopPlan, 'staff', planState)
      )
    case 'advanced_reports':
      return (
        canAccessTierFeature(tier, 'advanced_reports') ||
        planTierIncludes(shopPlan, 'reports', planState)
      )
    case 'online_deposit':
      return (
        canAccessTierFeature(tier, 'online_deposit') ||
        planTierIncludes(shopPlan, 'stripe', planState)
      )
    case 'website_builder':
      return planTierIncludes(shopPlan, 'website_builder', planState)
    case 'multi_shop':
      return planTierIncludes(shopPlan, 'multi_shop', planState)
    case 'landing_page':
      return canAccessTierFeature(tier, 'landing_page')
    case 'ai_images':
      return canAccessTierFeature(tier, 'ai_images')
    case 'edit_price_self_service':
      return canAccessTierFeature(tier, 'edit_price_self_service')
    case 'real_photography_upsell':
      return canAccessTierFeature(tier, 'real_photography_upsell')
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
  return tierDefaultForOverrideId(id, tier, shopPlan, planState, context)
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

export function buildAllEnabledOverrides(): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const id of FEATURE_OVERRIDE_IDS) {
    out[id] = true
  }
  return out
}
