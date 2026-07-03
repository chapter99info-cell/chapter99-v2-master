import type { ReactNode } from 'react'
import { usePlan } from '../../hooks/usePlan'
import {
  buildWhatsAppUpgradeUrl,
  canAccessFeature,
  FEATURE_LABELS_TH,
  minimumTierForFeature,
  normalizeFeatureTier,
  TIER_LABELS,
  type FeatureKey,
  type FeatureTier,
} from '../../lib/featureGate'
import { hasFeatureKey, shopFeatureContextFromPlanState } from '../../lib/shopFeatureAccess'

export interface FeatureGateProps {
  plan: FeatureTier
  feature: FeatureKey
  children: ReactNode
  /** When true and locked, render nothing */
  hideIfLocked?: boolean
  shopName?: string
}

export function FeatureGate({
  plan,
  feature,
  children,
  hideIfLocked = false,
  shopName,
  featureContext,
}: FeatureGateProps & {
  featureContext?: ReturnType<typeof shopFeatureContextFromPlanState>
}) {
  const allowed = featureContext
    ? hasFeatureKey(featureContext, feature)
    : canAccessFeature(plan, feature)

  if (allowed) {
    return <>{children}</>
  }

  if (hideIfLocked) {
    return null
  }

  const requiredTier = minimumTierForFeature(feature)
  const whatsappUrl = buildWhatsAppUpgradeUrl(feature, shopName)

  return (
    <div className="relative min-h-[8rem] rounded-xl border border-[#E5E7EB] bg-[#F8F5F0] overflow-hidden">
      <div
        className="pointer-events-none select-none blur-[3px] opacity-50 p-4"
        aria-hidden
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white/85 p-6 text-center">
        <span className="text-3xl" aria-hidden>
          🔒
        </span>
        <p className="text-base font-medium text-[#1A1A1A] max-w-sm">
          ฟีเจอร์ &ldquo;{FEATURE_LABELS_TH[feature]}&rdquo; ต้องใช้แพ็กเกจ{' '}
          <strong>{TIER_LABELS[requiredTier]}</strong> ขึ้นไป
        </p>
        <p className="text-sm text-[#6B7280] max-w-sm">
          ติดต่อ Chapter99 เพื่ออัปเกรดแพ็กเกจของคุณ
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#2D5016] px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#234012]"
        >
          อัปเกรดทาง WhatsApp
        </a>
      </div>
    </div>
  )
}

/** Reads plan from PlanProvider and passes normalized tier to FeatureGate */
export function FeatureGateFromPlan({
  feature,
  children,
  hideIfLocked,
  shopName,
}: Omit<FeatureGateProps, 'plan'>) {
  const planState = usePlan()
  const tier = normalizeFeatureTier(planState.plan)
  const featureContext = shopFeatureContextFromPlanState(planState)

  if (planState.loading && hideIfLocked) return null
  if (planState.loading) {
    return <p className="text-sm text-[#6B7280] p-4">Loading plan…</p>
  }

  return (
    <FeatureGate
      plan={tier}
      feature={feature}
      hideIfLocked={hideIfLocked}
      shopName={shopName}
      featureContext={featureContext}
    >
      {children}
    </FeatureGate>
  )
}

export interface FeatureGatedTabProps {
  plan: FeatureTier
  feature: FeatureKey
  label: string
  active: boolean
  onSelect: () => void
  shopName?: string
}

/** Nav tab — locked tabs open WhatsApp upgrade instead of selecting */
export function FeatureGatedTab({
  plan,
  feature,
  label,
  active,
  onSelect,
  shopName,
  featureContext,
}: FeatureGatedTabProps & {
  featureContext?: ReturnType<typeof shopFeatureContextFromPlanState>
}) {
  const allowed = featureContext
    ? hasFeatureKey(featureContext, feature)
    : canAccessFeature(plan, feature)

  if (allowed) {
    return (
      <button
        type="button"
        className={`app-tab${active ? ' active' : ''}`}
        onClick={onSelect}
      >
        {label}
      </button>
    )
  }

  const whatsappUrl = buildWhatsAppUpgradeUrl(feature, shopName)

  return (
    <button
      type="button"
      className={`app-tab app-tab-locked${active ? ' active' : ''}`}
      onClick={() => window.open(whatsappUrl, '_blank', 'noopener,noreferrer')}
      title={`ต้องใช้แพ็กเกจ ${TIER_LABELS[minimumTierForFeature(feature)]} ขึ้นไป`}
    >
      {label}
      <span className="app-tab-lock" aria-hidden>
        {' '}
        🔒
      </span>
    </button>
  )
}

export function useShopFeatureContext() {
  const planState = usePlan()
  return shopFeatureContextFromPlanState(planState)
}

export function useFeatureTier(): FeatureTier {
  const { plan } = usePlan()
  return normalizeFeatureTier(plan)
}
