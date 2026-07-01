import { useCallback, useEffect, useState } from 'react'
import {
  fetchShopSmsSettings,
  fetchSmsUsage,
  saveShopSmsSettings,
  SMS_PACKAGE_OPTIONS,
  type ShopSmsSettings,
  type SmsUsageSnapshot,
} from '../../lib/smsUsageService'
import { SHOP_UPDATED_EVENT } from '../../lib/shopLogo'
import '../admin/ShopDepositSettings.css'

interface ShopSmsSettingsProps {
  shopId: string
  shopName: string
}

export default function ShopSmsSettings({ shopId, shopName }: ShopSmsSettingsProps) {
  const [settings, setSettings] = useState<ShopSmsSettings | null>(null)
  const [usage, setUsage] = useState<SmsUsageSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [sms, u] = await Promise.all([
      fetchShopSmsSettings(shopId),
      fetchSmsUsage(shopId),
    ])
    setSettings(sms)
    setUsage(u)
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const persist = async (next: ShopSmsSettings) => {
    setSettings(next)
    setSaveState('saving')
    setSaveError('')
    const result = await saveShopSmsSettings(shopId, next)
    if (!result.ok) {
      setSaveState('error')
      setSaveError(result.error ?? 'Save failed')
      return
    }
    setSaveState('saved')
    window.dispatchEvent(new Event(SHOP_UPDATED_EVENT))
    const u = await fetchSmsUsage(shopId)
    setUsage(u)
    setTimeout(() => setSaveState('idle'), 2000)
  }

  if (loading || !settings) {
    return <p className="sws-muted">Loading SMS settings…</p>
  }

  const usageWarning = usage && usage.smsLimit > 0 && usage.pctUsed >= 80

  return (
    <div className="shop-sms-settings">
      <h4 className="shop-detail-subtitle">SMS Settings — {shopName}</h4>
      <p className="sws-muted">
        Super Admin only. When disabled, all SMS sends are skipped silently.
      </p>

      <label className="sws-toggle-row">
        <span>SMS Enabled</span>
        <input
          type="checkbox"
          checked={settings.smsEnabled}
          onChange={e => void persist({ ...settings, smsEnabled: e.target.checked })}
        />
      </label>

      {settings.smsEnabled && (
        <label className="sws-field">
          SMS package
          <select
            value={settings.smsPackage}
            onChange={e =>
              void persist({
                ...settings,
                smsPackage: e.target.value as ShopSmsSettings['smsPackage'],
              })
            }
          >
            {SMS_PACKAGE_OPTIONS.filter(o => o.value !== 'none').map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label} — {opt.price}
              </option>
            ))}
          </select>
        </label>
      )}

      {usage && settings.smsEnabled && (
        <div className={`sws-usage-block${usageWarning ? ' warning' : ''}`}>
          <p>
            Usage {usage.yearMonth}: <strong>{usage.smsCount}</strong> / {usage.smsLimit} SMS
            ({usage.pctUsed}%)
          </p>
          <div className="sws-usage-bar">
            <div
              className="sws-usage-fill"
              style={{ width: `${Math.min(usage.pctUsed, 100)}%` }}
            />
          </div>
          {usageWarning && (
            <p className="sws-warning">⚠️ 80%+ quota — consider upgrading package</p>
          )}
        </div>
      )}

      {saveState === 'saving' && <p className="sws-muted">Saving…</p>}
      {saveState === 'saved' && <p className="sws-success">Saved</p>}
      {saveState === 'error' && <p className="sws-error">{saveError}</p>}
    </div>
  )
}
