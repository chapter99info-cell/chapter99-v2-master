/** Subscription plan tiers (shops.plan) */
export type ShopPlan = 'starter' | 'growth' | 'pro'

export const SHOP_PLANS: ShopPlan[] = ['starter', 'growth', 'pro']

export const PLAN_LABELS: Record<ShopPlan, string> = {
  starter: 'Starter',
  growth: 'Growth',
  pro: 'Pro',
}

/** Setup + monthly subscription (Super Admin / Add Shop wizard). */
export interface PlanPricing {
  setup: number
  monthly: number
  label: string
}

export const PLAN_PRICING: Record<ShopPlan, PlanPricing> = {
  starter: { setup: 199, monthly: 69, label: 'Starter' },
  growth: { setup: 499, monthly: 129, label: 'Growth' },
  pro: { setup: 899, monthly: 199, label: 'Pro' },
}

export const PLAN_MONTHLY_FEES: Record<ShopPlan, number> = {
  starter: PLAN_PRICING.starter.monthly,
  growth: PLAN_PRICING.growth.monthly,
  pro: PLAN_PRICING.pro.monthly,
}

/** Super Admin MRR breakdown (highest tier first). */
export const MRR_PLAN_DISPLAY_ORDER: ShopPlan[] = ['pro', 'growth', 'starter']

export const MRR_PLAN_COLORS: Record<ShopPlan, string> = {
  starter: '#3B6D11',
  growth: '#BA7517',
  pro: '#0F6E56',
}

/** Feature keys checked via usePlan().can('…') */
export type PlanFeature =
  | 'booking'
  | 'queue'
  | 'pos'
  | 'staff'
  | 'gift_vouchers'
  | 'reports'
  | 'customer_history'
  | 'website_builder'
  | 'multi_shop'
  | 'stripe'
  | 'sms'

export interface ShopPlanAddons {
  addonStripe: boolean
  addonSms: boolean
  addonWebsite: boolean
  addonReports: boolean
}

export interface ShopPlanState extends ShopPlanAddons {
  plan: ShopPlan
}

const STARTER_FEATURES: PlanFeature[] = ['booking', 'queue', 'pos', 'staff']

const GROWTH_FEATURES: PlanFeature[] = [
  ...STARTER_FEATURES,
  'gift_vouchers',
  'reports',
  'customer_history',
]

const PRO_FEATURES: PlanFeature[] = [
  ...GROWTH_FEATURES,
  'website_builder',
  'multi_shop',
]

export const PLAN_TIER_FEATURES: Record<ShopPlan, PlanFeature[]> = {
  starter: STARTER_FEATURES,
  growth: GROWTH_FEATURES,
  pro: PRO_FEATURES,
}

/** Minimum plan that includes a tier feature (for upgrade messaging). */
export const FEATURE_MIN_PLAN: Record<PlanFeature, ShopPlan> = {
  booking: 'starter',
  queue: 'starter',
  pos: 'starter',
  staff: 'starter',
  gift_vouchers: 'growth',
  reports: 'growth',
  customer_history: 'growth',
  website_builder: 'pro',
  multi_shop: 'pro',
  stripe: 'growth',
  sms: 'pro',
}

export function normalizeShopPlan(value: string | null | undefined): ShopPlan {
  const p = (value ?? 'starter').toLowerCase()
  if (p === 'growth' || p === 'professional') return 'growth'
  if (p === 'pro' || p === 'business' || p === 'business_plus') return 'pro'
  if (p === 'starter') return 'starter'
  return 'starter'
}

export function planRank(plan: ShopPlan): number {
  if (plan === 'pro') return 3
  if (plan === 'growth') return 2
  return 1
}

export function canAccessFeature(state: ShopPlanState, feature: PlanFeature): boolean {
  const tier = new Set(PLAN_TIER_FEATURES[state.plan])

  if (tier.has(feature)) return true

  switch (feature) {
    case 'stripe':
      return state.addonStripe
    case 'sms':
      // SMS is Super Admin toggle only — never included in tier features
      return state.addonSms
    case 'website_builder':
      return state.addonWebsite || state.plan === 'pro'
    case 'reports':
      return state.addonReports || tier.has('reports')
    default:
      return false
  }
}

export function requiredPlanForFeature(feature: PlanFeature, state: ShopPlanState): ShopPlan {
  if (canAccessFeature(state, feature)) return state.plan
  if (FEATURE_MIN_PLAN[feature]) return FEATURE_MIN_PLAN[feature]
  return 'pro'
}

export const PLAN_COMPARISON_ROWS: {
  label: string
  starter: boolean
  growth: boolean
  pro: boolean
}[] = [
  { label: 'Booking & queue', starter: true, growth: true, pro: true },
  { label: 'POS & staff', starter: true, growth: true, pro: true },
  { label: 'Gift vouchers', starter: false, growth: true, pro: true },
  { label: 'Reports & CSV export', starter: false, growth: true, pro: true },
  { label: 'Customer history (POS)', starter: false, growth: true, pro: true },
  { label: 'Website builder', starter: false, growth: false, pro: true },
  { label: 'Multi-shop', starter: false, growth: false, pro: true },
  { label: 'Stripe / SMS add-ons', starter: false, growth: false, pro: false },
]
