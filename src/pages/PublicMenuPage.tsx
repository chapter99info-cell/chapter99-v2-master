import { useEffect, useMemo, useState } from 'react'
import { useShopContext } from '../contexts/ShopContext'
import { supabase } from '../lib/supabase'
import './PublicSite.css'
import '../components/booking/PublicBookingWizard.css'

interface MenuServiceRow {
  id: string
  name_en: string
  name_th: string | null
  duration: number
  price: number
  gst_free: boolean
  image_url: string | null
  category: string | null
  sort_order: number | null
}

function normalizeCategory(category: string | null | undefined): string {
  const value = (category ?? '').trim()
  return value || 'other'
}

function categoryTabLabel(category: string): string {
  const key = normalizeCategory(category)
  if (key === 'other') return 'Other'
  return key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

function formatPrice(price: number, gstFree: boolean): string {
  return `$${Number(price).toFixed(0)}${gstFree ? '' : ' incl. GST'}`
}

export default function PublicMenuPage() {
  const { shop, shopId, loading: shopLoading, businessType } = useShopContext()
  const [services, setServices] = useState<MenuServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all')
  const isRestaurant = businessType === 'restaurant'

  useEffect(() => {
    if (!shopId) return
    let cancelled = false
    setLoading(true)
    supabase
      .from('services')
      .select(
        'id, name_en, name_th, duration, price, gst_free, image_url, category, sort_order'
      )
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.error('[PublicMenuPage] load services failed', error)
          setServices([])
        } else {
          setServices((data as MenuServiceRow[]) ?? [])
        }
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shopId])

  const categories = useMemo(() => {
    const set = new Set<string>()
    services.forEach(svc => set.add(normalizeCategory(svc.category)))
    return Array.from(set).sort((a, b) => {
      if (a === 'other') return 1
      if (b === 'other') return -1
      return a.localeCompare(b)
    })
  }, [services])

  const filteredServices = useMemo(() => {
    if (categoryFilter === 'all') return services
    return services.filter(svc => normalizeCategory(svc.category) === categoryFilter)
  }, [services, categoryFilter])

  const shopName = shop?.name || (shopLoading ? '…' : 'Menu')
  const logoUrl = shop?.logoUrl?.trim()

  return (
    <div className="public-page public-menu-page">
      <header className="public-menu-header">
        {logoUrl ? (
          <img src={logoUrl} alt={shopName} className="public-menu-logo" />
        ) : (
          <div className="public-menu-logo-placeholder" aria-hidden>
            {shopName.charAt(0).toUpperCase()}
          </div>
        )}
        <h1 className="public-menu-shop-name">{shopName}</h1>
        <p className="public-menu-tagline">
          {isRestaurant ? 'Digital menu' : 'Treatment menu'} · Prices in AUD
        </p>
      </header>

      {loading || shopLoading ? (
        <p className="public-empty">Loading menu…</p>
      ) : services.length === 0 ? (
        <p className="public-empty">Menu coming soon.</p>
      ) : (
        <>
          <div className="pbw-service-category-tabs" role="tablist" aria-label="Menu categories">
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'all'}
              className={`pbw-service-category-tab pbw-service-category-tab--all${categoryFilter === 'all' ? ' active' : ''}`}
              onClick={() => setCategoryFilter('all')}
            >
              ALL
            </button>
            <div className="pbw-service-category-tabs-scroll">
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  role="tab"
                  aria-selected={categoryFilter === cat}
                  className={`pbw-service-category-tab${categoryFilter === cat ? ' active' : ''}`}
                  onClick={() => setCategoryFilter(cat)}
                >
                  {categoryTabLabel(cat)}
                </button>
              ))}
            </div>
          </div>

          <div className="pbw-service-grid">
            {filteredServices.length === 0 ? (
              <p className="pbw-services-empty">No items in this category.</p>
            ) : (
              filteredServices.map(svc => (
                <div key={svc.id} className="pbw-service-card pbw-service-card--static">
                  {svc.image_url ? (
                    <img src={svc.image_url} alt="" className="pbw-service-img" loading="lazy" />
                  ) : (
                    <div className="pbw-service-img placeholder" aria-hidden>
                      💆
                    </div>
                  )}
                  <div className="pbw-service-body">
                    <p className="pbw-service-name">{svc.name_en}</p>
                    {svc.name_th && <p className="pbw-service-meta">{svc.name_th}</p>}
                    {!isRestaurant && (
                      <p className="pbw-service-meta">
                        {svc.duration} min{svc.gst_free ? ' · GST-free' : ''}
                      </p>
                    )}
                    <p className="pbw-service-price">{formatPrice(svc.price, svc.gst_free)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
