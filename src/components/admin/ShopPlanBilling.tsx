import { useCallback, useEffect, useState } from 'react'
import {
  fetchShopPlanSettings,
  saveShopPlanSettings,
  type ShopPlanSettings,
} from '../../lib/planService'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import { PLAN_LABELS, SHOP_PLANS, type ShopPlan } from '../../types/plan'
import Toast, { type ToastType } from '../ui/Toast'
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

function settingsEqual(a: ShopPlanSettings, b: ShopPlanSettings): boolean {
  return (
    a.plan === b.plan &&
    a.addonStripe === b.addonStripe &&
    a.addonSms === b.addonSms &&
    a.addonWebsite === b.addonWebsite &&
    a.addonReports === b.addonReports
  )
}

export default function ShopPlanBilling({ shopId, shopName, embedded }: ShopPlanBillingProps) {
  const [saved, setSaved] = useState<ShopPlanSettings | null>(null)
  const [draft, setDraft] = useState<ShopPlanSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShopPlanSettings(shopId).then(data => {
      if (!cancelled) {
        setSaved(data)
        setDraft(data)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shopId])

  const isDirty = saved && draft ? !settingsEqual(saved, draft) : false

  const handleSave = useCallback(async () => {
    if (!draft || !isDirty) return
    setSaving(true)
    setSaveError('')
    const result = await saveShopPlanSettings(draft)
    setSaving(false)
    if (!result.ok) {
      const msg = result.error ?? 'บันทึกไม่สำเร็จ'
      setSaveError(msg)
      setToast({ message: msg, type: 'error' })
      return
    }
    setSaved(draft)
    setToast({ message: 'บันทึกแพ็กเกจและ add-ons แล้ว', type: 'success' })
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
  }, [draft, isDirty])

  if (loading || !draft) {
    return <p className="spb-muted">Loading plan settings…</p>
  }

  return (
    <section className={`spb-panel${embedded ? ' spb-panel-embedded' : ''}`}>
      <div className="spb-header">
        <span className={`spb-plan-badge spb-plan-${draft.plan}`}>
          {PLAN_LABELS[draft.plan]}
        </span>
        {isDirty ? (
          <span className="spb-save-badge spb-save-dirty">ยังไม่ได้บันทึก</span>
        ) : (
          <span className="spb-save-badge spb-save-saved">บันทึกแล้ว</span>
        )}
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
          value={draft.plan}
          onChange={e => setDraft({ ...draft, plan: e.target.value as ShopPlan })}
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
                checked={draft[key]}
                onChange={e => setDraft({ ...draft, [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="spb-actions">
        <button
          type="button"
          className="sws-btn sws-btn-primary"
          disabled={saving || !isDirty}
          onClick={() => void handleSave()}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกแพ็กเกจ'}
        </button>
        <button
          type="button"
          className="sws-btn sws-btn-ghost"
          disabled={saving || !isDirty}
          onClick={() => saved && setDraft(saved)}
        >
          ยกเลิก
        </button>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </section>
  )
}
