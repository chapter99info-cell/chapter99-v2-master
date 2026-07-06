import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchShopPlanStateResult } from '../../lib/planService'
import { setAllShopFeatureOverrides } from '../../lib/featureOverrideService'
import {
  buildAllEnabledOverrides,
  FEATURE_OVERRIDE_LABELS,
  FEATURE_OVERRIDE_LABELS_TH,
  FEATURE_TOGGLE_GROUPS,
  hasFeature,
  planDefaultForFeature,
  shopFeatureContextFromPlanState,
  tierLabelForPlan,
  type FeatureOverrideId,
} from '../../lib/shopFeatureAccess'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import { PLAN_LABELS } from '../../types/plan'
import Toast, { type ToastType } from '../ui/Toast'
import '../admin/ShopDepositSettings.css'
import './ShopFeatureToggles.css'

interface ShopFeatureTogglesProps {
  shopId: string
  shopName: string
  plan: string
}

type OverrideMode = 'default' | 'on' | 'off'

function overrideModeFor(id: FeatureOverrideId, overrides: Record<string, boolean>): OverrideMode {
  if (!(id in overrides)) return 'default'
  return overrides[id] ? 'on' : 'off'
}

function overridesEqual(a: Record<string, boolean>, b: Record<string, boolean>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  for (const key of keys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

function FeatureToggleCard({
  id,
  context,
  overrides,
  onSetMode,
}: {
  id: FeatureOverrideId
  context: ReturnType<typeof shopFeatureContextFromPlanState>
  overrides: Record<string, boolean>
  onSetMode: (id: FeatureOverrideId, mode: OverrideMode) => void
}) {
  const mode = overrideModeFor(id, overrides)
  const effective = hasFeature(context, id)
  const planDefault = planDefaultForFeature(context, id)
  const overridden = mode !== 'default'
  const labelTh = FEATURE_OVERRIDE_LABELS_TH[id]

  return (
    <article className={`shop-feature-card${overridden ? ' is-overridden' : ''}`}>
      <div className="shop-feature-card-head">
        <span className="shop-feature-card-label">{FEATURE_OVERRIDE_LABELS[id]}</span>
        {labelTh && <span className="shop-feature-card-label-th">{labelTh}</span>}
        <div className="shop-feature-card-meta">
          <span className="shop-feature-badge shop-feature-badge-default">
            แพ็กเกจ: {planDefault ? 'เปิด' : 'ปิด'}
          </span>
          <span
            className={`shop-feature-badge shop-feature-badge-${effective ? 'on' : 'off'} shop-feature-badge-effective`}
          >
            ใช้งานจริง: {effective ? 'เปิด' : 'ปิด'}
          </span>
        </div>
      </div>

      <div className="sft-triple-toggle" role="group" aria-label={FEATURE_OVERRIDE_LABELS[id]}>
        <button
          type="button"
          className={mode === 'default' ? 'active' : ''}
          data-state="default"
          onClick={() => onSetMode(id, 'default')}
        >
          ตามแพ็กเกจ
        </button>
        <button
          type="button"
          className={mode === 'on' ? 'active' : ''}
          data-state="on"
          onClick={() => onSetMode(id, 'on')}
        >
          บังคับเปิด
        </button>
        <button
          type="button"
          className={mode === 'off' ? 'active' : ''}
          data-state="off"
          onClick={() => onSetMode(id, 'off')}
        >
          บังคับปิด
        </button>
      </div>
    </article>
  )
}

export default function ShopFeatureToggles({ shopId, shopName, plan }: ShopFeatureTogglesProps) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [savedOverrides, setSavedOverrides] = useState<Record<string, boolean>>({})
  const [draftOverrides, setDraftOverrides] = useState<Record<string, boolean>>({})
  const [planState, setPlanState] = useState<
    Awaited<ReturnType<typeof fetchShopPlanStateResult>>['state'] | null
  >(null)

  const isDirty = !overridesEqual(savedOverrides, draftOverrides)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    const result = await fetchShopPlanStateResult(shopId)
    if (result.error) {
      setError(result.error)
      setToast({
        message: `โหลด feature toggles ไม่สำเร็จ: ${result.error}`,
        type: 'error',
      })
    }
    const loaded = result.state.featureOverrides ?? {}
    setPlanState(result.state)
    setSavedOverrides(loaded)
    setDraftOverrides(loaded)
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const draftContext = useMemo(() => {
    if (!planState) return null
    return shopFeatureContextFromPlanState({
      ...planState,
      featureOverrides: draftOverrides,
    })
  }, [planState, draftOverrides])

  function handleSetMode(id: FeatureOverrideId, mode: OverrideMode) {
    const currentMode = overrideModeFor(id, draftOverrides)
    if (currentMode === mode) return

    setDraftOverrides(prev => {
      const next = { ...prev }
      if (mode === 'default') {
        delete next[id]
      } else {
        next[id] = mode === 'on'
      }
      return next
    })
  }

  function handleEnableAllDraft() {
    setDraftOverrides(buildAllEnabledOverrides())
  }

  function handleResetAllDraft() {
    setDraftOverrides({})
  }

  function handleDiscard() {
    setDraftOverrides(savedOverrides)
    setError('')
  }

  async function handleSaveAll() {
    if (!isDirty) return
    setSaving(true)
    setError('')
    const result = await setAllShopFeatureOverrides(shopId, draftOverrides)
    setSaving(false)

    if (!result.ok) {
      const msg = result.error ?? 'บันทึกไม่สำเร็จ'
      setError(msg)
      setToast({ message: msg, type: 'error' })
      return
    }

    setSavedOverrides(result.overrides)
    setDraftOverrides(result.overrides)
    setPlanState(prev => (prev ? { ...prev, featureOverrides: result.overrides } : prev))
    setError('')
    setToast({ message: 'บันทึกการตั้งค่าฟีเจอร์ทั้งหมดแล้ว', type: 'success' })
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
  }

  if (loading || !draftContext || !planState) {
    return <p className="sws-muted">Loading feature toggles…</p>
  }

  const planLabel = PLAN_LABELS[planState.plan] ?? tierLabelForPlan(plan)

  return (
    <div className="shop-feature-toggles">
      <p className="sws-muted shop-feature-toggles-intro">
        Override individual features for <strong>{shopName}</strong> without changing plan tier (
        {planLabel}). ปรับหลายรายการได้ก่อน แล้วกด <strong>บันทึกทั้งหมด</strong> — มีผลหลังรีเฟรชแดชบอร์ดพนักงาน
      </p>

      <div className={`shop-feature-toggles-toolbar${isDirty ? ' is-dirty' : ''}`}>
        <button
          type="button"
          className="sws-btn sws-btn-primary shop-feature-save-all"
          disabled={saving || !isDirty}
          onClick={() => void handleSaveAll()}
        >
          {saving ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}
        </button>
        <button
          type="button"
          className="sws-btn sws-btn-ghost"
          disabled={saving || !isDirty}
          onClick={handleDiscard}
        >
          ยกเลิกการเปลี่ยนแปลง
        </button>
        <button
          type="button"
          className="sws-btn sws-btn-ghost"
          disabled={saving}
          onClick={handleEnableAllDraft}
        >
          เปิดทั้งหมด (ร่าง)
        </button>
        <button
          type="button"
          className="sws-btn sws-btn-ghost"
          disabled={saving}
          onClick={handleResetAllDraft}
        >
          รีเซ็ตเป็นค่าแพ็กเกจ (ร่าง)
        </button>
        {isDirty && (
          <span className="shop-feature-dirty-hint" role="status">
            มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
          </span>
        )}
      </div>

      {error && (
        <p className="sws-error" role="alert">
          {error}
        </p>
      )}

      {FEATURE_TOGGLE_GROUPS.map(group => (
        <section key={group.title} className="shop-feature-toggles-section">
          <h4 className="shop-feature-toggles-section-title">
            {group.titleTh}{' '}
            <span className="shop-feature-card-label-th">({group.title})</span>
          </h4>
          <div className="shop-feature-toggles-grid">
            {group.ids.map(id => (
              <FeatureToggleCard
                key={id}
                id={id}
                context={draftContext}
                overrides={draftOverrides}
                onSetMode={handleSetMode}
              />
            ))}
          </div>
        </section>
      ))}

      {isDirty && (
        <div className="shop-feature-toggles-footer">
          <button
            type="button"
            className="sws-btn sws-btn-primary shop-feature-save-all"
            disabled={saving}
            onClick={() => void handleSaveAll()}
          >
            {saving ? 'กำลังบันทึก…' : 'บันทึกทั้งหมด'}
          </button>
        </div>
      )}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
