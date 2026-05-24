import { useCallback, useEffect, useRef, useState } from 'react'
import {
  fetchServiceImages,
  fetchShopWebsiteSettings,
  saveServiceImageUrl,
  saveShopWebsiteSettings,
} from '../../lib/shopWebsiteService'
import { fetchShop, uploadServiceImage, uploadShopAsset } from '../../lib/shopService'
import { notifyShopUpdated } from '../../lib/shopLogo'
import {
  REDIRECT_PATH_OPTIONS,
  type ServiceImageRow,
  type ShopWebsiteSettings,
} from '../../types/shopWebsite'
import './ShopWebsiteSettings.css'

interface ShopWebsiteSettingsProps {
  shopId: string
  shopName: string
}

type PageToggleKey =
  | 'pageHomeEnabled'
  | 'pageServicesEnabled'
  | 'pageVouchersEnabled'
  | 'pageAboutEnabled'

const PAGE_TOGGLES: { key: PageToggleKey; label: string }[] = [
  { key: 'pageHomeEnabled', label: 'Home page' },
  { key: 'pageServicesEnabled', label: 'Services page' },
  { key: 'pageVouchersEnabled', label: 'Gift Vouchers' },
  { key: 'pageAboutEnabled', label: 'About page' },
]

export default function ShopWebsiteSettingsPanel({
  shopId,
  shopName,
}: ShopWebsiteSettingsProps) {
  const [settings, setSettings] = useState<ShopWebsiteSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState('')
  const [services, setServices] = useState<ServiceImageRow[]>([])
  const [uploading, setUploading] = useState<string | null>(null)
  const [reviewRequestEnabled, setReviewRequestEnabled] = useState<boolean | null>(null)
  const settingsRef = useRef<ShopWebsiteSettings | null>(null)

  const loadServices = useCallback(async () => {
    const rows = await fetchServiceImages(shopId)
    setServices(rows)
  }, [shopId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([
      fetchShopWebsiteSettings(shopId),
      fetchServiceImages(shopId),
      fetchShop(shopId),
    ]).then(([data, svc, shop]) => {
      if (!cancelled) {
        setSettings(data)
        settingsRef.current = data
        setServices(svc)
        setReviewRequestEnabled(shop.reviewRequestEnabled === true)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shopId])

  const persist = useCallback(async (next: ShopWebsiteSettings) => {
    settingsRef.current = next
    setSettings(next)
    setSaveState('saving')
    setSaveError('')
    const result = await saveShopWebsiteSettings(next)
    if (!result.ok) {
      setSaveState('error')
      setSaveError(result.error ?? 'Save failed')
      return
    }
    setSaveState('saved')
    notifyShopUpdated()
    window.setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000)
  }, [])

  async function handleShopImageUpload(
    kind: 'hero' | 'logo',
    file: File
  ) {
    setUploading(kind)
    setSaveError('')
    console.log('[ShopWebsiteSettings] hero/logo upload start', {
      shopId,
      kind,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    })
    const { url, error } = await uploadShopAsset(shopId, file, kind)
    if (error || !url) {
      console.error('[ShopWebsiteSettings] upload failed', { shopId, kind, error })
      setUploading(null)
      setSaveError(error ?? 'Upload failed')
      return
    }
    const base = settingsRef.current
    if (!base) {
      console.error('[ShopWebsiteSettings] settings ref empty after upload', { shopId, kind })
      setUploading(null)
      setSaveError('Settings not loaded — refresh and try again')
      return
    }
    const next =
      kind === 'hero'
        ? { ...base, heroImageUrl: url }
        : { ...base, logoUrl: url }
    console.log('[ShopWebsiteSettings] saving to shops table', {
      shopId,
      kind,
      column: kind === 'hero' ? 'hero_image_url' : 'logo_url',
      url,
    })
    await persist(next)
    setUploading(null)
  }

  async function handleRemoveShopImage(kind: 'hero' | 'logo') {
    const base = settingsRef.current
    if (!base) return
    const next =
      kind === 'hero' ? { ...base, heroImageUrl: '' } : { ...base, logoUrl: '' }
    await persist(next)
  }

  async function handleServiceImageUpload(serviceId: string, file: File) {
    setUploading(`svc-${serviceId}`)
    setSaveError('')
    const { url, error } = await uploadServiceImage(shopId, serviceId, file)
    if (error || !url) {
      setUploading(null)
      setSaveError(error ?? 'Upload failed')
      return
    }
    const saved = await saveServiceImageUrl(serviceId, url)
    setUploading(null)
    if (!saved.ok) {
      setSaveError(saved.error ?? 'Could not save service image')
      return
    }
    await loadServices()
    setSaveState('saved')
    window.setTimeout(() => setSaveState(s => (s === 'saved' ? 'idle' : s)), 2000)
  }

  async function handleRemoveServiceImage(serviceId: string) {
    setUploading(`svc-${serviceId}`)
    const saved = await saveServiceImageUrl(serviceId, null)
    setUploading(null)
    if (!saved.ok) {
      setSaveError(saved.error ?? 'Remove failed')
      return
    }
    await loadServices()
  }

  const update = useCallback(
    <K extends keyof ShopWebsiteSettings>(key: K, value: ShopWebsiteSettings[K]) => {
      const base = settingsRef.current
      if (!base) return
      const next = { ...base, [key]: value }
      void persist(next)
    },
    [persist]
  )

  const updateField = useCallback(
    <K extends keyof ShopWebsiteSettings>(key: K, value: ShopWebsiteSettings[K]) => {
      const base = settingsRef.current
      if (!base) return
      const next = { ...base, [key]: value }
      settingsRef.current = next
      setSettings(next)
    },
    []
  )

  const flushField = useCallback(() => {
    const base = settingsRef.current
    if (base) void persist(base)
  }, [persist])

  if (loading || !settings) {
    return <p className="sws-muted">Loading website settings…</p>
  }

  const publicPreview = settings.slug
    ? `${window.location.origin}/?shop=${encodeURIComponent(settings.slug)}`
    : `${window.location.origin}/book`

  return (
    <section className="sws-panel">
      <div className="sws-header">
        <p className="sws-muted sws-intro">
          Public storefront for <strong>{shopName}</strong> — auto-saves on toggle or when you
          leave a field.
        </p>
        <span className={`sws-save-badge sws-save-${saveState}`}>
          {saveState === 'saving' && 'Saving…'}
          {saveState === 'saved' && 'Saved'}
          {saveState === 'error' && 'Error'}
          {saveState === 'idle' && 'Auto-save'}
        </span>
      </div>
      {saveError && <p className="sws-error">{saveError}</p>}

      {reviewRequestEnabled !== null && (
        <p className="sws-review-status">
          Google review requests after POS:{' '}
          <strong>{reviewRequestEnabled ? 'Enabled' : 'Disabled'}</strong>
          <span className="sws-muted"> (owner configures in Shop Settings)</span>
        </p>
      )}

      <div className="sws-preview">
        <span className="sws-preview-label">Preview</span>
        <a href={publicPreview} target="_blank" rel="noreferrer" className="sws-preview-link">
          {publicPreview}
        </a>
      </div>

      {/* ── Images ── */}
      <div className="sws-block">
        <h4 className="sws-block-title">รูปภาพ</h4>
        <div className="sws-images-grid">
          <ImageUploadCard
            label="Hero image"
            hint="แบนเนอร์หน้าแรก (แนะนำ 1600×600)"
            imageUrl={settings.heroImageUrl}
            uploading={uploading === 'hero'}
            onUpload={file => handleShopImageUpload('hero', file)}
            onRemove={() => handleRemoveShopImage('hero')}
          />
          <ImageUploadCard
            label="Logo"
            hint="แสดงที่ header และ receipt"
            imageUrl={settings.logoUrl}
            uploading={uploading === 'logo'}
            onUpload={file => handleShopImageUpload('logo', file)}
            onRemove={() => handleRemoveShopImage('logo')}
          />
        </div>

        <h5 className="sws-images-subtitle">Services images</h5>
        <p className="sws-muted sws-images-hint">
          รูปแต่ละบริการบนหน้า Services — อัปโหลดจากรายการด้านล่าง
        </p>
        {services.length === 0 ? (
          <p className="sws-muted">ยังไม่มีบริการในระบบ — เพิ่มใน Owner → Services</p>
        ) : (
          <div className="sws-service-images">
            {services.map(svc => (
              <div key={svc.id} className="sws-service-image-row">
                <div className="sws-service-image-meta">
                  <strong>{svc.nameEn}</strong>
                  {!svc.active && <span className="sws-inactive-tag">inactive</span>}
                </div>
                <div className="sws-service-image-actions">
                  {svc.imageUrl ? (
                    <img
                      src={svc.imageUrl}
                      alt=""
                      className="sws-thumb"
                    />
                  ) : (
                    <span className="sws-thumb sws-thumb-empty">No image</span>
                  )}
                  <label className="sws-upload-btn">
                    {uploading === `svc-${svc.id}` ? 'Uploading…' : 'Upload'}
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      hidden
                      disabled={uploading !== null}
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) void handleServiceImageUpload(svc.id, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  {svc.imageUrl && (
                    <button
                      type="button"
                      className="sws-remove-btn"
                      disabled={uploading !== null}
                      onClick={() => handleRemoveServiceImage(svc.id)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Page visibility ── */}
      <div className="sws-block">
        <h4 className="sws-block-title">Page visibility</h4>
        <div className="sws-toggles">
          {PAGE_TOGGLES.map(({ key, label }) => (
            <label key={key} className="sws-toggle-row">
              <span>{label}</span>
              <input
                type="checkbox"
                className="sws-switch"
                checked={settings[key]}
                onChange={e => update(key, e.target.checked)}
              />
            </label>
          ))}
        </div>
        <div className="sws-field sws-redirect">
          <label htmlFor="sws-redirect">Redirect path when page is OFF</label>
          <select
            id="sws-redirect"
            value={settings.disabledRedirectPath}
            onChange={e => update('disabledRedirectPath', e.target.value)}
          >
            {REDIRECT_PATH_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Website content ── */}
      <div className="sws-block">
        <h4 className="sws-block-title">Website content</h4>
        <p className="sws-muted sws-block-hint">Auto-saves when you leave a field.</p>
        <div className="sws-row-2">
          <div className="sws-field">
            <label htmlFor="sws-hero-title">Hero title</label>
            <input
              id="sws-hero-title"
              value={settings.heroTitle}
              placeholder={shopName}
              onChange={e => updateField('heroTitle', e.target.value)}
              onBlur={flushField}
            />
          </div>
          <div className="sws-field">
            <label htmlFor="sws-hero-sub">Hero subtitle</label>
            <textarea
              id="sws-hero-sub"
              rows={2}
              value={settings.heroSubtitle}
              placeholder="ข้อความต้อนรับสั้นๆ"
              onChange={e => updateField('heroSubtitle', e.target.value)}
              onBlur={flushField}
            />
          </div>
        </div>
        <div className="sws-field">
          <label htmlFor="sws-about-text">About text</label>
          <textarea
            id="sws-about-text"
            rows={4}
            value={settings.aboutText}
            placeholder="เรื่องราวร้าน เวลาเปิด ที่จอดรถ…"
            onChange={e => updateField('aboutText', e.target.value)}
            onBlur={flushField}
          />
        </div>
        <div className="sws-row-2">
          <div className="sws-field">
            <label htmlFor="sws-about-phone">Phone</label>
            <input
              id="sws-about-phone"
              value={settings.aboutPhone}
              placeholder="ว่างไว้ = ใช้เบอร์ใน Shop settings"
              onChange={e => updateField('aboutPhone', e.target.value)}
              onBlur={flushField}
            />
          </div>
          <div className="sws-field">
            <label htmlFor="sws-about-address">Address</label>
            <input
              id="sws-about-address"
              value={settings.aboutAddress}
              placeholder="ว่างไว้ = ใช้ที่อยู่ใน Shop settings"
              onChange={e => updateField('aboutAddress', e.target.value)}
              onBlur={flushField}
            />
          </div>
        </div>
        <div className="sws-field">
          <label htmlFor="sws-maps">Google Maps URL</label>
          <input
            id="sws-maps"
            type="url"
            value={settings.googleMapsUrl}
            placeholder="https://maps.google.com/…"
            onChange={e => updateField('googleMapsUrl', e.target.value)}
            onBlur={flushField}
          />
        </div>
        <div className="sws-row-2">
          <div className="sws-field">
            <label htmlFor="sws-privacy">Privacy Policy URL</label>
            <input
              id="sws-privacy"
              type="url"
              value={settings.privacyPolicyUrl}
              placeholder="https://…/privacy"
              onChange={e => updateField('privacyPolicyUrl', e.target.value)}
              onBlur={flushField}
            />
          </div>
          <div className="sws-field">
            <label htmlFor="sws-terms">Terms of Service URL</label>
            <input
              id="sws-terms"
              type="url"
              value={settings.termsUrl}
              placeholder="https://…/terms"
              onChange={e => updateField('termsUrl', e.target.value)}
              onBlur={flushField}
            />
          </div>
        </div>
      </div>
    </section>
  )
}

function ImageUploadCard({
  label,
  hint,
  imageUrl,
  uploading,
  onUpload,
  onRemove,
}: {
  label: string
  hint: string
  imageUrl: string
  uploading: boolean
  onUpload: (file: File) => void
  onRemove: () => void
}) {
  return (
    <div className="sws-image-card">
      <div className="sws-image-card-head">
        <strong>{label}</strong>
        <span className="sws-muted">{hint}</span>
      </div>
      <div className="sws-image-card-body">
        {imageUrl ? (
          <img src={imageUrl} alt="" className="sws-image-preview" />
        ) : (
          <div className="sws-image-preview sws-image-preview-empty">No image</div>
        )}
        <div className="sws-image-card-actions">
          <label className="sws-upload-btn">
            {uploading ? 'Uploading…' : 'Upload'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              hidden
              disabled={uploading}
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onUpload(f)
                e.target.value = ''
              }}
            />
          </label>
          {imageUrl && (
            <button type="button" className="sws-remove-btn" disabled={uploading} onClick={onRemove}>
              Remove
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
