import { useState, type ReactNode } from 'react'
import { usePlan } from '../../hooks/usePlan'
import type { PlanFeature } from '../../types/plan'
import { PLAN_LABELS } from '../../types/plan'
import UpgradeModal from './UpgradeModal'

const FEATURE_LABELS: Record<PlanFeature, string> = {
  booking: 'Booking',
  queue: 'Queue',
  pos: 'POS',
  staff: 'Staff',
  gift_vouchers: 'Gift vouchers',
  reports: 'Reports',
  customer_history: 'Customer history',
  website_builder: 'Website builder',
  multi_shop: 'Multi-shop',
  stripe: 'Stripe payments',
  sms: 'SMS notifications',
}

interface PlanGatedTabProps {
  feature: PlanFeature
  label: string
  active: boolean
  onSelect: () => void
}

/** Nav tab button — shows lock when feature not in plan; opens upgrade modal on click. */
export function PlanGatedTab({ feature, label, active, onSelect }: PlanGatedTabProps) {
  const { can, plan, requiredPlan } = usePlan()
  const [showUpgrade, setShowUpgrade] = useState(false)
  const allowed = can(feature)

  return (
    <>
      <button
        type="button"
        className={`app-tab${active ? ' active' : ''}${!allowed ? ' app-tab-locked' : ''}`}
        onClick={() => {
          if (!allowed) {
            setShowUpgrade(true)
            return
          }
          onSelect()
        }}
      >
        {label}
        {!allowed && <span className="app-tab-lock" aria-hidden> 🔒</span>}
      </button>
      {showUpgrade && (
        <UpgradeModal
          featureLabel={FEATURE_LABELS[feature]}
          requiredPlan={requiredPlan(feature)}
          currentPlan={plan}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  )
}

interface PlanGateProps {
  feature: PlanFeature
  children: ReactNode
  /** Shown when locked instead of children */
  lockedFallback?: ReactNode
}

/** Renders children only if plan allows; otherwise locked fallback or upgrade prompt. */
export function PlanGate({ feature, children, lockedFallback }: PlanGateProps) {
  const { can, loading, plan, requiredPlan } = usePlan()
  const [showUpgrade, setShowUpgrade] = useState(false)

  if (loading) return null
  if (can(feature)) return <>{children}</>

  return (
    <>
      {lockedFallback ?? (
        <div className="plan-gate-locked">
          <p>
            🔒 <strong>{FEATURE_LABELS[feature]}</strong> requires {PLAN_LABELS[requiredPlan(feature)]}{' '}
            or higher.
          </p>
          <button type="button" className="upgrade-contact-btn" onClick={() => setShowUpgrade(true)}>
            View upgrade options
          </button>
        </div>
      )}
      {showUpgrade && (
        <UpgradeModal
          featureLabel={FEATURE_LABELS[feature]}
          requiredPlan={requiredPlan(feature)}
          currentPlan={plan}
          onClose={() => setShowUpgrade(false)}
        />
      )}
    </>
  )
}
