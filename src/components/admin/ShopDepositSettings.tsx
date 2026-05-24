import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchDepositMonthStats,
  fetchShopDepositSettings,
  saveShopDepositSettings,
} from '../../lib/shopDepositService'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import { formatAUD } from '../../lib/posCalc'
import type { DepositType, ShopDepositSettings } from '../../types/shopDeposit'
import './ShopWebsiteSettings.css'
import './ShopDepositSettings.css'

interface ShopDepositSettingsPanelProps {
  shopId: string
  shopName: string
  /** Owner view — status only, no edits */
  readOnly?: boolean
}

export default function ShopDepositSettingsPanel({
  shopId,
  shopName,
  readOnly = false,
}: ShopDepositSettingsPanelProps) {
  const [settings, setSettings] = useState<ShopDepositSettings | null>(null)
  const [stats, setStats] = useState({ collected: 0, pending: 0, refunds: 0 })
  const [monthLabel, setMonthLabel] = useState('')
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const settingsRef = useRef<ShopDepositSettings | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [deposit, month] = await Promise.all([
      fetchShopDepositSettings(shopId),
      fetchDepositMonthStats(shopId),
    ])
    setSettings(deposit)
    settingsRef.current = deposit
    setStats(month.stats)
    setMonthLabel(month.monthLabel)
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const persist = useCallback(
    async (next: ShopDepositSettings) => {
      if (readOnly) return
      settingsRef.current = next
      setSettings(next)
      setSaveState('saving')
      setSaveError('')
      const result = await saveShopDepositSettings(next)
      if (!result.ok) {
        setSaveState('error')
        setSaveError(result.error ?? 'Save failed')
        return
      }
      setSaveState('saved')
      window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
      window.setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000)
    },
    [readOnly]
  )

  function patch(partial: Partial<ShopDepositSettings>) {
    const base = settingsRef.current
    if (!base) return
    void persist({ ...base, ...partial })
  }

  if (loading || !settings) {
    return <p className="sws-muted">Loading deposit settings…</p>
  }

  const stripeReady = settings.addonStripe && settings.stripeConfigured

  return (
    <div className="sws-panel sds-panel">
      <div className="sws-header">
        <p className="sws-intro sws-muted">
          {readOnly
            ? `Online booking deposits for ${shopName} (managed by Chapter99).`
            : `Stripe prepayment for ${shopName} public bookings.`}
        </p>
        {!readOnly && (
          <span className={`sws-save-badge sws-save-${saveState}`}>
            {saveState === 'saving' && 'Saving…'}
            {saveState === 'saved' && 'Saved'}
            {saveState === 'error' && 'Error'}
            {saveState === 'idle' && 'Auto-save'}
          </span>
        )}
        {readOnly && (
          <span className="sws-save-badge sws-save-saved">View only</span>
        )}
      </div>

      {saveError && <p className="sws-error">{saveError}</p>}

      {!stripeReady && (
        <div className="plan-gate-locked" style={{ marginBottom: 16 }}>
          <p>🔒 Stripe is not enabled for this shop.</p>
          <p className="sws-muted">
            Enable the Stripe add-on and publishable key in Plan &amp; add-ons, or contact
            Chapter99.
          </p>
        </div>
      )}

      <label className="sws-toggle-row">
        <input
          type="checkbox"
          checked={settings.depositEnabled}
          disabled={readOnly || !stripeReady}
          onChange={e => patch({ depositEnabled: e.target.checked })}
        />
        <span>Enable deposit for online bookings</span>
      </label>

      {settings.depositEnabled && stripeReady && (
        <>
          <div className="sws-field">
            <label>Deposit type</label>
            <div className="sds-type-row">
              <label className="sds-type-option">
                <input
                  type="radio"
                  name={`deposit-type-${shopId}`}
                  checked={settings.depositType === 'percent'}
                  disabled={readOnly}
                  onChange={() => patch({ depositType: 'percent' as DepositType })}
                />
                % Percentage
              </label>
              <label className="sds-type-option">
                <input
                  type="radio"
                  name={`deposit-type-${shopId}`}
                  checked={settings.depositType === 'fixed'}
                  disabled={readOnly}
                  onChange={() => patch({ depositType: 'fixed' as DepositType })}
                />
                $ Fixed amount
              </label>
            </div>
          </div>

          {settings.depositType === 'percent' ? (
            <div className="sws-field">
              <label>Deposit percentage: {settings.depositPercent}%</label>
              <input
                type="range"
                min={10}
                max={50}
                step={5}
                value={settings.depositPercent}
                disabled={readOnly}
                onChange={e =>
                  patch({ depositPercent: parseInt(e.target.value, 10) || 20 })
                }
              />
              <p className="sws-muted">10%–50% of service price (default 20%).</p>
            </div>
          ) : (
            <div className="sws-field">
              <label>Fixed deposit (AUD)</label>
              <input
                type="number"
                min={0.5}
                step={0.5}
                value={settings.depositFixedAmount}
                disabled={readOnly}
                onChange={e =>
                  patch({ depositFixedAmount: parseFloat(e.target.value) || 20 })
                }
              />
            </div>
          )}

          <div className="sws-field">
            <label>Refund window (hours before appointment)</label>
            <input
              type="number"
              min={1}
              max={168}
              value={settings.depositRefundHours}
              disabled={readOnly}
              onChange={e =>
                patch({ depositRefundHours: parseInt(e.target.value, 10) || 24 })
              }
            />
            <p className="sws-muted">
              Full deposit refund when cancelled at least this many hours before the
              appointment (default 24).
            </p>
          </div>
        </>
      )}

      <div className="sds-stats">
        <p className="sds-stats-title">{monthLabel} — deposit activity</p>
        <div className="sds-stats-grid">
          <div className="sds-stat">
            <span className="sds-stat-label">Deposits collected</span>
            <span className="sds-stat-value">{formatAUD(stats.collected)}</span>
          </div>
          <div className="sds-stat">
            <span className="sds-stat-label">Pending deposits</span>
            <span className="sds-stat-value">{formatAUD(stats.pending)}</span>
          </div>
          <div className="sds-stat">
            <span className="sds-stat-label">Refunds issued</span>
            <span className="sds-stat-value">{formatAUD(stats.refunds)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
