import { useCallback, useEffect, useState } from 'react'
import { fetchShopCustomDomain, updateShopCustomDomain } from '../../lib/adminService'
import { normalizeCustomDomain } from '../../lib/shopDomain'
import Toast, { type ToastType } from '../ui/Toast'

interface ShopCustomDomainProps {
  shopId: string
  shopSlug?: string
}

export default function ShopCustomDomain({ shopId, shopSlug }: ShopCustomDomainProps) {
  const [domain, setDomain] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchShopCustomDomain(shopId).then(value => {
      if (!cancelled) {
        setDomain(value)
        setLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [shopId])

  const save = useCallback(async () => {
    setSaving(true)
    const normalized = normalizeCustomDomain(domain)
    const ok = await updateShopCustomDomain(shopId, normalized || null)
    setSaving(false)
    if (ok) {
      setDomain(normalized)
      setToast({
        message: normalized
          ? 'Custom domain saved. Add it to SHOP_DOMAIN_MAP in Vercel if not already.'
          : 'Custom domain cleared',
        type: 'success',
      })
    } else {
      setToast({ message: 'Could not save custom domain', type: 'error' })
    }
  }, [domain, shopId])

  const mapHint =
    domain.trim() && shopSlug
      ? `{"${normalizeCustomDomain(domain)}": "${shopSlug.trim().toLowerCase()}"}`
      : null

  return (
    <section className="shop-custom-domain" aria-labelledby="shop-custom-domain-heading">
      <h3 id="shop-custom-domain-heading" className="shop-detail-subtitle">
        Custom Domain
      </h3>
      <p className="sws-muted">
        Hostname only (no https). Also add the same mapping in Vercel env{' '}
        <code>SHOP_DOMAIN_MAP</code> (and <code>VITE_SHOP_DOMAIN_MAP</code> for the client build).
      </p>
      <div className="shop-custom-domain-field">
        <input
          type="text"
          className="shop-custom-domain-input"
          placeholder="mira-thai-massage.com.au"
          value={domain}
          disabled={loading || saving}
          onChange={e => setDomain(e.target.value)}
          onBlur={() => setDomain(normalizeCustomDomain(domain))}
        />
        <button
          type="button"
          className="action-btn"
          disabled={loading || saving}
          onClick={() => void save()}
        >
          {saving ? 'Saving…' : 'Save domain'}
        </button>
      </div>
      {mapHint && (
        <p className="sws-muted shop-custom-domain-map-hint">
          Vercel JSON entry: <code>{mapHint}</code>
        </p>
      )}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </section>
  )
}
