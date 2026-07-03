import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchShopPlanState } from '../../lib/planService'
import { setShopFeatureOverride } from '../../lib/featureOverrideService'
import {
  FEATURE_OVERRIDE_IDS,
  FEATURE_OVERRIDE_LABELS,
  getFeatureOverride,
  hasFeature,
  planDefaultForFeature,
  shopFeatureContextFromPlanState,
  tierLabelForPlan,
  type FeatureOverrideId,
} from '../../lib/shopFeatureAccess'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import { PLAN_LABELS } from '../../types/plan'
import '../admin/ShopDepositSettings.css'

interface ShopFeatureTogglesProps {
  shopId: string
  shopName: string
  plan: string
}

export default function ShopFeatureToggles({ shopId, shopName, plan }: ShopFeatureTogglesProps) {
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState<FeatureOverrideId | null>(null)
  const [error, setError] = useState('')
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [planState, setPlanState] = useState<Awaited<ReturnType<typeof fetchShopPlanState>> | null>(
    null
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const state = await fetchShopPlanState(shopId)
    setPlanState(state)
    setOverrides(state.featureOverrides ?? {})
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const context = useMemo(() => {
    if (!planState) return null
    return shopFeatureContextFromPlanState(planState)
  }, [planState])

  async function handleToggle(id: FeatureOverrideId, next: boolean) {
    setSavingId(id)
    setError('')
    const result = await setShopFeatureOverride(shopId, id, next, overrides)
    setSavingId(null)
    if (!result.ok) {
      setError(result.error ?? 'Save failed')
      return
    }
    setOverrides(result.overrides)
    setPlanState(prev =>
      prev ? { ...prev, featureOverrides: result.overrides } : prev
    )
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
  }

  async function handleReset(id: FeatureOverrideId) {
    setSavingId(id)
    setError('')
    const result = await setShopFeatureOverride(shopId, id, null, overrides)
    setSavingId(null)
    if (!result.ok) {
      setError(result.error ?? 'Reset failed')
      return
    }
    setOverrides(result.overrides)
    setPlanState(prev =>
      prev ? { ...prev, featureOverrides: result.overrides } : prev
    )
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
  }

  if (loading || !context) {
    return <p className="sws-muted">Loading feature toggles…</p>
  }

  const planLabel = PLAN_LABELS[planState.plan] ?? tierLabelForPlan(plan)

  return (
    <div className="shop-feature-toggles">
      <p className="sws-muted shop-feature-toggles-intro">
        Override individual features for <strong>{shopName}</strong> without changing plan tier (
        {planLabel}). Changes save to Supabase and apply on the shop&apos;s next page load.
      </p>

      {error && (
        <p className="sws-error" role="alert">
          {error}
        </p>
      )}

      <ul className="shop-feature-toggle-list">
        {FEATURE_OVERRIDE_IDS.map(id => {
          const effective = hasFeature(context, id)
          const overridden = getFeatureOverride(context, id) !== undefined
          const planDefault = planDefaultForFeature(context, id)
          const busy = savingId === id

          return (
            <li key={id} className="shop-feature-toggle-row">
              <div className="shop-feature-toggle-meta">
                <span className="shop-feature-toggle-label">{FEATURE_OVERRIDE_LABELS[id]}</span>
                <span className="shop-feature-toggle-hint">
                  Plan default: {planDefault ? 'On' : 'Off'}
                  {overridden ? ' · Overridden' : ''}
                </span>
              </div>
              <div className="shop-feature-toggle-actions">
                {overridden && (
                  <button
                    type="button"
                    className="sws-btn sws-btn-ghost"
                    disabled={busy}
                    onClick={() => void handleReset(id)}
                  >
                    Reset
                  </button>
                )}
                <label className="shop-feature-switch">
                  <input
                    type="checkbox"
                    checked={effective}
                    disabled={busy}
                    onChange={e => void handleToggle(id, e.target.checked)}
                  />
                  <span className="shop-feature-switch-ui" aria-hidden />
                  <span className="sr-only">
                    {FEATURE_OVERRIDE_LABELS[id]} {effective ? 'on' : 'off'}
                  </span>
                </label>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
