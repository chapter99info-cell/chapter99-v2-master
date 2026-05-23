import { useEffect, useMemo, useState } from 'react'
import { useShopContext } from '../contexts/ShopContext'
import { supabase } from '../lib/supabase'
import './PublicSite.css'

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

function categoryLabel(category: string): string {
  const key = category.trim() || 'other'
  return key.replace(/_/g, ' ').replace(/\b\w/g, ch => ch.toUpperCase())
}

function groupServicesByCategory(services: MenuServiceRow[]): [string, MenuServiceRow[]][] {
  const map = new Map<string, MenuServiceRow[]>()
  for (const svc of services) {
    const key = (svc.category?.trim() || 'other').toLowerCase()
    const list = map.get(key) ?? []
    list.push(svc)
    map.set(key, list)
  }
  return Array.from(map.entries()).sort(([a], [b]) => {
    if (a === 'other') return 1
    if (b === 'other') return -1
    return a.localeCompare(b)
  })
}

export default function PublicMenuPage() {
  const { shop, shopId, loading: shopLoading, businessType } = useShopContext()
  const [services, setServices] = useState<MenuServiceRow[]>([])
  const [loading, setLoading] = useState(true)
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

  const grouped = useMemo(() => groupServicesByCategory(services), [services])
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
        <div className="public-menu-sections">
          {grouped.map(([category, items]) => (
            <section key={category} className="public-menu-category">
              <h2 className="public-menu-category-title">{categoryLabel(category)}</h2>
              <ul className="public-menu-list">
                {items.map(svc => (
                  <li key={svc.id} className="public-menu-item">
                    {svc.image_url ? (
                      <img
                        src={svc.image_url}
                        alt=""
                        className="public-menu-item-photo"
                        loading="lazy"
                      />
                    ) : (
                      <div className="public-menu-item-photo public-menu-item-photo-empty" />
                    )}
                    <div className="public-menu-item-body">
                      <h3 className="public-menu-item-name">{svc.name_en}</h3>
                      {svc.name_th && (
                        <p className="public-menu-item-name-th">{svc.name_th}</p>
                      )}
                      {!isRestaurant && (
                        <p className="public-menu-item-meta">
                          {svc.duration} min
                          {svc.gst_free ? ' · GST-free' : ''}
                        </p>
                      )}
                    </div>
                    <span className="public-menu-item-price">
                      ${Number(svc.price).toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
