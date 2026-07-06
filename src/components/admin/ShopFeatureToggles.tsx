import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchShopPlanStateResult } from '../../lib/planService'
import { setAllShopFeatureOverrides, setShopFeatureOverride } from '../../lib/featureOverrideService'
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

function FeatureToggleCard({
  id,
  context,
  overrides,
  busy,
  onSetMode,
}: {
  id: FeatureOverrideId
  context: ReturnType<typeof shopFeatureContextFromPlanState>
  overrides: Record<string, boolean>
  busy: boolean
  onSetMode: (id: FeatureOverrideId, mode: OverrideMode) => void
}) {
  const mode = overrideModeFor(id, overrides)
  const effective = hasFeature(context, id)
  const planDefault = planDefaultForFeature(context, id)
  const overridden = mode !== 'default'
  const labelTh = FEATURE_OVERRIDE_LABELS_TH[id]

  return (
    <article
      className={`shop-feature-card${overridden ? ' is-overridden' : ''}${busy ? ' is-busy' : ''}`}
    >
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
          disabled={busy}
          onClick={() => onSetMode(id, 'default')}
        >
          ตามแพ็กเกจ
        </button>
        <button
          type="button"
          className={mode === 'on' ? 'active' : ''}
          data-state="on"
          disabled={busy}
          onClick={() => onSetMode(id, 'on')}
        >
          บังคับเปิด
        </button>
        <button
          type="button"
          className={mode === 'off' ? 'active' : ''}
          data-state="off"
          disabled={busy}
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
  const [savingId, setSavingId] = useState<FeatureOverrideId | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})
  const [planState, setPlanState] = useState<
    Awaited<ReturnType<typeof fetchShopPlanStateResult>>['state'] | null
  >(null)

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
    setPlanState(result.state)
    setOverrides(result.state.featureOverrides ?? {})
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const context = useMemo(() => {
    if (!planState) return null
    return shopFeatureContextFromPlanState(planState)
  }, [planState])

  function applySaveResult(
    result: { ok: boolean; error?: string; overrides: Record<string, boolean> },
    successMessage: string
  ) {
    if (!result.ok) {
      const msg = result.error ?? 'บันทึกไม่สำเร็จ'
      setError(msg)
      setToast({ message: msg, type: 'error' })
      return
    }
    setOverrides(result.overrides)
    setPlanState(prev => (prev ? { ...prev, featureOverrides: result.overrides } : prev))
    setError('')
    setToast({ message: successMessage, type: 'success' })
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
  }

  async function handleSetMode(id: FeatureOverrideId, mode: OverrideMode) {
    const currentMode = overrideModeFor(id, overrides)
    if (currentMode === mode) return

    setSavingId(id)
    setSaving(true)
    setError('')

    const enabled = mode === 'default' ? null : mode === 'on'
    const result = await setShopFeatureOverride(shopId, id, enabled, overrides)

    setSavingId(null)
    setSaving(false)

    applySaveResult(
      result,
      `${FEATURE_OVERRIDE_LABELS[id]} — ${
        mode === 'default' ? 'รีเซ็ตตามแพ็กเกจแล้ว' : mode === 'on' ? 'บังคับเปิดแล้ว' : 'บังคับปิดแล้ว'
      }`
    )
  }

  async function handleEnableAll() {
    setSaving(true)
    setError('')
    const next = buildAllEnabledOverrides()
    const result = await setAllShopFeatureOverrides(shopId, next)
    setSaving(false)
    applySaveResult(result, 'เปิดฟีเจอร์ทั้งหมดแล้ว')
  }

  async function handleResetAll() {
    setSaving(true)
    setError('')
    const result = await setAllShopFeatureOverrides(shopId, {})
    setSaving(false)
    applySaveResult(result, 'รีเซ็ตเป็นค่าแพ็กเกจแล้ว')
  }

  if (loading || !context || !planState) {
    return <p className="sws-muted">Loading feature toggles…</p>
  }

  const planLabel = PLAN_LABELS[planState.plan] ?? tierLabelForPlan(plan)
  const anyBusy = saving || savingId !== null

  return (
    <div className="shop-feature-toggles">
      <p className="sws-muted shop-feature-toggles-intro">
        Override individual features for <strong>{shopName}</strong> without changing plan tier (
        {planLabel}). Changes save to Supabase and apply on the shop&apos;s next page load.
      </p>

      <div className="shop-feature-toggles-toolbar">
        <button
          type="button"
          className="sws-btn sws-btn-primary"
          disabled={anyBusy}
          onClick={() => void handleEnableAll()}
        >
          เปิดทั้งหมด
        </button>
        <button
          type="button"
          className="sws-btn sws-btn-ghost"
          disabled={anyBusy}
          onClick={() => void handleResetAll()}
        >
          รีเซ็ตเป็นค่าแพ็กเกจ
        </button>
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
                context={context}
                overrides={overrides}
                busy={anyBusy && savingId === id}
                onSetMode={handleSetMode}
              />
            ))}
          </div>
        </section>
      ))}

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
