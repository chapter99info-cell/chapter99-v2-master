import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchShopPlanSettings,
  saveShopPlanSettings,
  type ShopPlanSettings,
} from '../../lib/planService'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import { PLAN_LABELS, SHOP_PLANS, type ShopPlan } from '../../types/plan'
import './ShopPlanBilling.css'

interface ShopPlanBillingProps {
  shopId: string
  shopName: string
  /** Nested inside Website section — compact layout */
  embedded?: boolean
}

const ADDON_TOGGLES = [
  { key: 'addonStripe' as const, label: 'Stripe' },
  { key: 'addonSms' as const, label: 'SMS' },
  { key: 'addonWebsite' as const, label: 'Website' },
  { key: 'addonReports' as const, label: 'Reports' },
]

export default function ShopPlanBilling({ shopId, shopName, embedded }: ShopPlanBillingProps) {
  const [settings, setSettings] = useState<ShopPlanSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const settingsRef = useRef<ShopPlanSettings | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShopPlanSettings(shopId).then(data => {
      if (!cancelled) {
        setSettings(data)
        settingsRef.current = data
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shopId])

  const persist = useCallback(async (next: ShopPlanSettings) => {
    settingsRef.current = next
    setSettings(next)
    setSaveState('saving')
    setSaveError('')
    const result = await saveShopPlanSettings(next)
    if (!result.ok) {
      setSaveState('error')
      setSaveError(result.error ?? 'Save failed')
      return
    }
    setSaveState('saved')
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
    window.setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000)
  }, [])

  if (loading || !settings) {
    return <p className="spb-muted">Loading plan settings…</p>
  }

  return (
    <section className={`spb-panel${embedded ? ' spb-panel-embedded' : ''}`}>
      <div className="spb-header">
        <span className={`spb-plan-badge spb-plan-${settings.plan}`}>
          {PLAN_LABELS[settings.plan]}
        </span>
        <span className={`spb-save-badge spb-save-${saveState}`}>
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && 'Error'}
          {saveState === 'idle' && 'Auto-save'}
        </span>
      </div>
      {!embedded && (
        <p className="spb-muted">
          Subscription for <strong>{shopName}</strong> — controls feature access in the staff app.
        </p>
      )}
      {saveError && <p className="spb-error">{saveError}</p>}

      <div className="spb-block">
        <label className="spb-label" htmlFor="spb-plan-select">
          Plan tier
        </label>
        <select
          id="spb-plan-select"
          className="spb-select"
          value={settings.plan}
          onChange={e => persist({ ...settings, plan: e.target.value as ShopPlan })}
        >
          {SHOP_PLANS.map(p => (
            <option key={p} value={p}>
              {PLAN_LABELS[p]}
            </option>
          ))}
        </select>
      </div>

      <div className="spb-block">
        <h4 className="spb-subtitle">Add-ons</h4>
        <p className="spb-muted spb-addon-hint">
          Optional extras — can unlock features below the shop&apos;s base tier.
        </p>
        <div className="spb-toggles">
          {ADDON_TOGGLES.map(({ key, label }) => (
            <label key={key} className="spb-toggle-row">
              <span>{label}</span>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={e => persist({ ...settings, [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}
