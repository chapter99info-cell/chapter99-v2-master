import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShopContext } from '../../contexts/ShopContext'
import { supabase } from '../../lib/supabase'
import { fetchPublicServices, isBookingRpcV1Enabled } from '../../lib/publicBookingRpc'
import { themeConfig } from './theme.config'

interface ServiceRow {
  id: string
  name_en: string
  name_th: string | null
  price: number
  image_url: string | null
}

const PLACEHOLDER_COUNT = 4

export default function GallerySlot() {
  const { shop, shopId, loading, withShopQuery, businessType } = useShopContext()
  const [services, setServices] = useState<ServiceRow[]>([])
  const isRestaurant = businessType === 'restaurant'
  const fallbackImages = [shop?.heroImageUrl, shop?.logoUrl].filter(Boolean) as string[]

  useEffect(() => {
    if (!shopId) return

    if (isBookingRpcV1Enabled()) {
      void fetchPublicServices(shopId).then(rows => {
        setServices(
          rows.slice(0, 6).map(row => ({
            id: row.id,
            name_en: row.name_en,
            name_th: row.name_th,
            price: row.price,
            image_url: row.image_url,
          }))
        )
      })
      return
    }

    supabase
      .from('services')
      .select('id, name_en, name_th, price, image_url')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .limit(6)
      .then(({ data }) => setServices((data as ServiceRow[]) ?? []))
  }, [shopId])

  const hasServices = services.length > 0

  return (
    <section style={{ padding: '56px 24px 64px', background: themeConfig.background }}>
      <p
        style={{
          margin: '0 0 8px',
          textAlign: 'center',
          color: themeConfig.secondaryColor,
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        ✦ Our Treatments ✦
      </p>
      <h2
        style={{
          margin: '0 0 8px',
          textAlign: 'center',
          color: themeConfig.primaryColor,
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 'clamp(1.75rem, 4vw, 2.25rem)',
        }}
      >
        {loading ? '…' : isRestaurant ? 'Signature Dishes' : 'Services Gallery'}
      </h2>
      <p
        style={{
          margin: '0 auto 32px',
          textAlign: 'center',
          maxWidth: '480px',
          color: '#6B7280',
          fontSize: '15px',
          lineHeight: 1.5,
        }}
      >
        {isRestaurant
          ? 'Crafted with authentic Thai ingredients and refined presentation.'
          : 'Ancient Thai techniques delivered with luxury care and attention.'}
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {hasServices
          ? services.map(svc => (
              <article
                key={svc.id}
                style={{
                  background: themeConfig.surface,
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: `1px solid ${themeConfig.secondaryColor}44`,
                  boxShadow: '0 4px 20px rgba(212, 175, 55, 0.08)',
                }}
              >
                {svc.image_url ? (
                  <img
                    src={svc.image_url}
                    alt={svc.name_en}
                    loading="lazy"
                    style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    style={{
                      aspectRatio: '4/3',
                      background: `linear-gradient(135deg, ${themeConfig.goldLight} 0%, ${themeConfig.background} 100%)`,
                    }}
                  />
                )}
                <div style={{ padding: '14px 16px' }}>
                  <h3
                    style={{
                      margin: '0 0 4px',
                      fontSize: '16px',
                      color: themeConfig.primaryColor,
                      fontFamily: '"Playfair Display", Georgia, serif',
                    }}
                  >
                    {svc.name_en}
                  </h3>
                  {svc.name_th && (
                    <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#6B7280' }}>{svc.name_th}</p>
                  )}
                  <p style={{ margin: 0, fontWeight: 700, color: themeConfig.secondaryColor }}>
                    ${Number(svc.price).toFixed(2)}
                  </p>
                </div>
              </article>
            ))
          : fallbackImages.length > 0
            ? fallbackImages.map((src, i) => (
                <img
                  key={src}
                  src={src}
                  alt={`Gallery ${i + 1}`}
                  loading="lazy"
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    objectFit: 'cover',
                    borderRadius: '12px',
                    border: `3px solid ${themeConfig.secondaryColor}`,
                  }}
                />
              ))
            : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
                <div
                  key={i}
                  style={{
                    aspectRatio: '1',
                    borderRadius: '12px',
                    background: `${themeConfig.secondaryColor}18`,
                    border: `2px dashed ${themeConfig.secondaryColor}88`,
                  }}
                />
              ))}
      </div>

      <p style={{ marginTop: '32px', textAlign: 'center' }}>
        <Link
          to={withShopQuery('/services')}
          style={{
            color: themeConfig.primaryColor,
            fontWeight: 600,
            textDecoration: 'none',
            borderBottom: `2px solid ${themeConfig.accentColor}`,
          }}
        >
          View all services →
        </Link>
      </p>
    </section>
  )
}
