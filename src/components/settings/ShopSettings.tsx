// Chapter99 V4 — Shop settings (Owner only)

import { useState, useEffect } from 'react'
import { THEME_PRESETS } from '../../types/pos'
import {
  fetchShop,
  saveShopSettings,
  uploadShopAsset,
  type ShopSettingsInput,
} from '../../lib/shopService'
import { notifyShopUpdated } from '../../lib/shopLogo'
import { SHOP_ID } from '../../lib/supabase'
import { testGoogleSheetConnection, refreshDailySheetSummary } from '../../lib/googleSheets'
import Toast, { type ToastType } from '../ui/Toast'
import { PlanGate } from '../plan/PlanGatedTab'
import MenuQrSection from './MenuQrSection'
import ShopDepositSettingsPanel from '../admin/ShopDepositSettings'
import '../admin/ShopDepositSettings.css'
import { sendReviewRequestPreview, type ReviewRequestChannel } from '../../lib/reviewRequestService'
import './ShopSettings.css'

interface ShopSettingsProps {
  shopId?: string
}

function shopToForm(shop: Awaited<ReturnType<typeof fetchShop>>): ShopSettingsInput {
  return {
    name: shop.name,
    abn: shop.abn,
    address: shop.address,
    phone: shop.phone,
    email: shop.email,
    notificationEmail: shop.notificationEmail ?? '',
    gstRegistered: shop.gstRegistered,
    logoUrl: shop.logoUrl,
    themeColor: shop.themeColor,
    providerName: shop.providerName,
    providerNumber: shop.providerNumber,
    signatureUrl: shop.signatureUrl,
    cardSurchargeRate: shop.cardSurchargeRate,
    amexSurchargeRate: shop.amexSurchargeRate,
    payidBsb: shop.payidBsb ?? '',
    payidAccount: shop.payidAccount ?? '',
    googleSheetUrl: shop.googleSheetUrl ?? '',
    googleSheetSyncEnabled: shop.googleSheetSyncEnabled ?? false,
    googleReviewUrl: shop.googleReviewUrl ?? '',
    reviewRequestEnabled: shop.reviewRequestEnabled ?? false,
    reviewRequestChannel: shop.reviewRequestChannel ?? 'email',
  }
}

export default function ShopSettings({ shopId = SHOP_ID }: ShopSettingsProps) {
  const [form, setForm] = useState<ShopSettingsInput | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState<'logo' | 'signature' | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [sheetTesting, setSheetTesting] = useState(false)
  const [shopSlug, setShopSlug] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    load()
  }, [shopId])

  async function load() {
    setLoading(true)
    setError('')
    const shop = await fetchShop(shopId)
    setForm(shopToForm(shop))
    setShopSlug(shop.slug ?? null)
    setLoading(false)
  }

  function update<K extends keyof ShopSettingsInput>(key: K, value: ShopSettingsInput[K]) {
    setForm(prev => (prev ? { ...prev, [key]: value } : prev))
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>, kind: 'logo' | 'signature') {
    const file = e.target.files?.[0]
    if (!file || !form) return
    setUploading(kind)
    const { url, error: uploadErr } = await uploadShopAsset(shopId, file, kind)
    setUploading(null)
    if (uploadErr) {
      setToast({ message: uploadErr, type: 'error' })
      return
    }
    const nextForm: ShopSettingsInput =
      kind === 'logo' ? { ...form, logoUrl: url } : { ...form, signatureUrl: url }
    setForm(nextForm)

    const saved = await saveShopSettings(shopId, nextForm)
    if (!saved.ok) {
      setToast({ message: saved.error ?? 'Uploaded but could not save URL to shop', type: 'error' })
      e.target.value = ''
      return
    }

    notifyShopUpdated()
    setToast({
      message: `${kind === 'logo' ? 'Logo' : 'Signature'} uploaded and saved`,
      type: 'success',
    })
    e.target.value = ''
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) {
      setError('Shop name is required')
      return
    }
    setSaving(true)
    setError('')
    const result = await saveShopSettings(shopId, form)
    setSaving(false)
    if (!result.ok) {
      setError(result.error ?? 'Save failed')
      setToast({ message: result.error ?? 'Save failed', type: 'error' })
      return
    }
    setToast({ message: 'Settings saved', type: 'success' })
    notifyShopUpdated()
  }

  async function handleTestSheet() {
    if (!form?.googleSheetUrl.trim()) {
      setToast({ message: 'Enter a Google Sheet URL first', type: 'error' })
      return
    }
    setSheetTesting(true)
    const result = await testGoogleSheetConnection(form.googleSheetUrl.trim(), shopId)
    setSheetTesting(false)
    if (result.ok) {
      setToast({
        message: `Connected: ${result.title ?? 'Spreadsheet'} (${result.sheetTitles?.length ?? 0} tabs)`,
        type: 'success',
      })
    } else {
      setToast({
        message: result.error ?? 'Connection failed — share sheet with service account email',
        type: 'error',
      })
    }
  }

  async function handleRefreshDailySummary() {
    if (!form?.googleSheetUrl.trim()) return
    setSheetTesting(true)
    const ok = await refreshDailySheetSummary(form.googleSheetUrl.trim(), shopId)
    setSheetTesting(false)
    setToast({
      message: ok ? 'Daily summary updated' : 'Could not update daily summary',
      type: ok ? 'success' : 'error',
    })
  }

  if (loading || !form) {
    return (
      <div className="shop-settings">
        <p className="ss-hint">Loading settings…</p>
      </div>
    )
  }

  return (
    <div className="shop-settings">
      <div className="ss-header">
        <h1 className="ss-title">⚙️ Shop Settings</h1>
        <p className="ss-subtitle">Logo, theme, receipt & health fund details</p>
      </div>

      {error && <p className="ss-error">{error}</p>}

      <section className="ss-section">
        <h2 className="ss-section-title">Branding</h2>
        <div className="ss-logo-row">
          <div className="ss-logo-preview">
            {form.logoUrl ? (
              <img src={form.logoUrl} alt="Shop logo" />
            ) : (
              <span className="ss-hint">No logo</span>
            )}
          </div>
          <div>
            <label className="ss-btn secondary" style={{ display: 'inline-block', cursor: 'pointer' }}>
              {uploading === 'logo' ? 'Uploading…' : 'Upload logo'}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                hidden
                onChange={e => handleLogoUpload(e, 'logo')}
                disabled={!!uploading}
              />
            </label>
            {form.logoUrl && (
              <button
                type="button"
                className="ss-btn secondary"
                style={{ marginLeft: 8 }}
                onClick={async () => {
                  if (!form) return
                  const nextForm = { ...form, logoUrl: undefined }
                  setForm(nextForm)
                  const saved = await saveShopSettings(shopId, nextForm)
                  if (saved.ok) notifyShopUpdated()
                  setToast({
                    message: saved.ok ? 'Logo removed' : (saved.error ?? 'Remove failed'),
                    type: saved.ok ? 'success' : 'error',
                  })
                }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        <p className="ss-hint" style={{ marginTop: 12 }}>
          Theme color (used on receipts & PDF headers)
        </p>
        <div className="ss-theme-grid">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={`ss-theme-swatch${form.themeColor === preset.hex ? ' selected' : ''}`}
              onClick={() => update('themeColor', preset.hex)}
            >
              <span className="ss-theme-dot" style={{ background: preset.hex }} />
              <span className="ss-theme-label">{preset.label}</span>
            </button>
          ))}
        </div>
        <div className="ss-field" style={{ marginTop: 12 }}>
          <label>Custom hex</label>
          <input
            type="text"
            value={form.themeColor}
            onChange={e => update('themeColor', e.target.value)}
            placeholder="#0F6E56"
            maxLength={7}
          />
        </div>
      </section>

      <section className="ss-section">
        <h2 className="ss-section-title">Shop details</h2>
        <div className="ss-field">
          <label>Shop name *</label>
          <input value={form.name} onChange={e => update('name', e.target.value)} />
        </div>
        <div className="ss-row">
          <div className="ss-field">
            <label>ABN</label>
            <input value={form.abn} onChange={e => update('abn', e.target.value)} placeholder="12 345 678 901" />
          </div>
          <div className="ss-field">
            <label>Phone</label>
            <input value={form.phone} onChange={e => update('phone', e.target.value)} />
          </div>
        </div>
        <div className="ss-field">
          <label>Address</label>
          <textarea value={form.address} onChange={e => update('address', e.target.value)} />
        </div>
        <div className="ss-field">
          <label>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />
        </div>
        <div className="ss-field">
          <label>Notification email</label>
          <input
            type="email"
            placeholder="owner@example.com"
            value={form.notificationEmail}
            onChange={e => update('notificationEmail', e.target.value)}
          />
          <p className="ss-hint">
            Receives an email when a new booking is confirmed (online or staff). Leave blank to use
            the shop email above.
          </p>
        </div>
        <label className="ss-checkbox">
          <input
            type="checkbox"
            checked={form.gstRegistered}
            onChange={e => update('gstRegistered', e.target.checked)}
          />
          GST registered
        </label>
      </section>

      <MenuQrSection shopSlug={shopSlug} shopName={form.name} />

      <section className="ss-section">
        <h2 className="ss-section-title">SMS notifications</h2>
        <PlanGate feature="sms">
          <p className="ss-hint">
            When enabled on your plan, POS can send a receipt confirmation SMS when you enter a
            customer phone at checkout. Booking SMS reminders use the same channel.
          </p>
          <p className="ss-hint">
            Shop phone above is shown on receipts; customer numbers are entered per transaction in
            POS.
          </p>
        </PlanGate>
      </section>

      <section className="ss-section">
        <h2 className="ss-section-title">Health fund provider</h2>
        <div className="ss-row">
          <div className="ss-field">
            <label>Provider name</label>
            <input
              value={form.providerName}
              onChange={e => update('providerName', e.target.value)}
            />
          </div>
          <div className="ss-field">
            <label>Provider number</label>
            <input
              value={form.providerNumber}
              onChange={e => update('providerNumber', e.target.value)}
            />
          </div>
        </div>
        <div className="ss-logo-row">
          {form.signatureUrl ? (
            <img src={form.signatureUrl} alt="Signature" style={{ maxHeight: 48 }} />
          ) : null}
          <label className="ss-btn secondary" style={{ display: 'inline-block', cursor: 'pointer' }}>
            {uploading === 'signature' ? 'Uploading…' : 'Upload signature'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={e => handleLogoUpload(e, 'signature')}
              disabled={!!uploading}
            />
          </label>
        </div>
      </section>

      <section className="ss-section">
        <h2 className="ss-section-title">Payment details</h2>
        <div className="ss-row">
          <div className="ss-field">
            <label>Card surcharge rate</label>
            <input
              type="number"
              step="0.001"
              min="0"
              max="0.1"
              value={form.cardSurchargeRate}
              onChange={e => update('cardSurchargeRate', parseFloat(e.target.value) || 0)}
            />
            <p className="ss-hint">e.g. 0.015 = 1.5%</p>
          </div>
          <div className="ss-field">
            <label>Amex surcharge rate</label>
            <input
              type="number"
              step="0.001"
              min="0"
              max="0.1"
              value={form.amexSurchargeRate}
              onChange={e => update('amexSurchargeRate', parseFloat(e.target.value) || 0)}
            />
          </div>
        </div>
        <div className="ss-row">
          <div className="ss-field">
            <label>PayID BSB</label>
            <input value={form.payidBsb} onChange={e => update('payidBsb', e.target.value)} />
          </div>
          <div className="ss-field">
            <label>PayID account</label>
            <input value={form.payidAccount} onChange={e => update('payidAccount', e.target.value)} />
          </div>
        </div>
      </section>

      <section className="ss-section">
        <h2 className="ss-section-title">💳 Deposit &amp; Prepayment</h2>
        <p className="ss-hint">
          Deposit rules are configured by Chapter99 Super Admin. You can view status and monthly
          totals below.
        </p>
        <div className="ss-deposit-readonly-wrap">
          <ShopDepositSettingsPanel shopId={shopId} shopName={form.name} readOnly />
        </div>
      </section>

      <section className="ss-section">
        <h2 className="ss-section-title">Review request</h2>
        <p className="ss-hint" style={{ marginBottom: 12 }}>
          After a successful POS payment, automatically ask customers to leave a Google review.
          Same email or phone is limited to one request every 30 days.
        </p>
        <label className="ss-checkbox">
          <input
            type="checkbox"
            checked={form.reviewRequestEnabled}
            onChange={e => update('reviewRequestEnabled', e.target.checked)}
          />
          Enable review requests after checkout
        </label>
        <div className="ss-field">
          <label>Google Review URL</label>
          <input
            type="url"
            placeholder="https://g.page/r/.../review"
            value={form.googleReviewUrl}
            onChange={e => update('googleReviewUrl', e.target.value)}
          />
          <p className="ss-hint">Paste your link from Google Business Profile.</p>
        </div>
        <div className="ss-field">
          <label>Send via</label>
          <select
            value={form.reviewRequestChannel}
            onChange={e =>
              update('reviewRequestChannel', e.target.value as ReviewRequestChannel)
            }
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="both">Both</option>
          </select>
        </div>
        {(form.reviewRequestChannel === 'sms' || form.reviewRequestChannel === 'both') && (
          <p className="ss-hint">SMS uses your Twilio add-on (Growth plan or SMS add-on).</p>
        )}
        <div className="ss-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="ss-btn secondary"
            disabled={
              previewLoading ||
              !form.googleReviewUrl.trim() ||
              (form.reviewRequestChannel === 'email' && !form.email.trim()) ||
              (form.reviewRequestChannel === 'sms' && !form.phone.trim()) ||
              (form.reviewRequestChannel === 'both' &&
                !form.email.trim() &&
                !form.phone.trim())
            }
            onClick={async () => {
              if (!form.googleReviewUrl.trim()) {
                setToast({ message: 'Add Google Review URL first', type: 'error' })
                return
              }
              setPreviewLoading(true)
              const result = await sendReviewRequestPreview(
                shopId,
                form.reviewRequestChannel,
                form.email.trim() || 'preview@example.com',
                form.phone.trim() || undefined
              )
              setPreviewLoading(false)
              setToast({
                message: result.ok
                  ? `Preview sent (${form.reviewRequestChannel})`
                  : (result.error ?? 'Preview failed'),
                type: result.ok ? 'success' : 'error',
              })
            }}
          >
            {previewLoading ? 'Sending preview…' : 'Send preview'}
          </button>
        </div>
      </section>

      <section className="ss-section">
        <h2 className="ss-section-title">Google Sheets (tax reporting)</h2>
        <p className="ss-hint" style={{ marginBottom: 12 }}>
          Auto-sync POS transactions and bookings. Share the sheet with your Google service
          account email (Editor). Set credentials in Vercel: GOOGLE_SERVICE_ACCOUNT_EMAIL,
          GOOGLE_PRIVATE_KEY.
        </p>
        <label className="ss-checkbox">
          <input
            type="checkbox"
            checked={form.googleSheetSyncEnabled}
            onChange={e => update('googleSheetSyncEnabled', e.target.checked)}
          />
          Enable auto-sync to Google Sheets
        </label>
        <div className="ss-field">
          <label>Google Sheet URL</label>
          <input
            type="url"
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={form.googleSheetUrl}
            onChange={e => update('googleSheetUrl', e.target.value)}
          />
        </div>
        <div className="ss-actions" style={{ marginTop: 8 }}>
          <button
            type="button"
            className="ss-btn secondary"
            disabled={sheetTesting || !form.googleSheetUrl.trim()}
            onClick={handleTestSheet}
          >
            {sheetTesting ? 'Testing…' : 'Test connection'}
          </button>
          <button
            type="button"
            className="ss-btn secondary"
            disabled={sheetTesting || !form.googleSheetUrl.trim()}
            onClick={handleRefreshDailySummary}
          >
            Refresh daily summary
          </button>
        </div>
        <p className="ss-hint">
          Sheets created automatically: Transactions, Bookings, Daily Summary
        </p>
      </section>

      <div className="ss-actions">
        <button type="button" className="ss-btn primary" disabled={saving} onClick={handleSave}>
          {saving ? 'Saving…' : 'Save settings'}
        </button>
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  )
}
