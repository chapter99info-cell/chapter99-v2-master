import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import { supabase } from '../lib/supabase'
import { fetchPublicServices, isBookingRpcV1Enabled } from '../lib/publicBookingRpc'
import './PublicSite.css'

interface ServiceRow {
  id: string
  name_en: string
  name_th: string | null
  duration: number
  price: number
  gst_free: boolean
  image_url: string | null
}

export default function PublicServicesPage() {
  const { shopId, businessType, withShopQuery } = useShopContext()
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const isRestaurant = businessType === 'restaurant'

  useEffect(() => {
    if (!shopId) return
    setLoading(true)

    if (isBookingRpcV1Enabled()) {
      void fetchPublicServices(shopId)
        .then(data => setServices(data))
        .finally(() => setLoading(false))
      return
    }

    supabase
      .from('services')
      .select('id, name_en, name_th, duration, price, gst_free, image_url')
      .eq('shop_id', shopId)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true })
      .then(({ data }) => {
        setServices((data as ServiceRow[]) ?? [])
        setLoading(false)
      })
  }, [shopId])

  return (
    <div className="public-page">
      <h1 className="public-page-title">{isRestaurant ? 'Our menu' : 'Our services'}</h1>
      <p className="public-page-lead">
        {isRestaurant
          ? 'Prices in AUD. Add items from the order page when ready.'
          : 'All treatments are performed by qualified therapists. Prices in AUD.'}
      </p>

      {loading ? (
        <p className="public-empty">Loading…</p>
      ) : services.length === 0 ? (
        <p className="public-empty">{isRestaurant ? 'Menu coming soon.' : 'Services coming soon.'}</p>
      ) : (
        <div className="public-service-list">
          {services.map(svc => (
            <article key={svc.id} className="public-service-item">
              {svc.image_url && (
                <img
                  src={svc.image_url}
                  alt=""
                  className="public-service-photo"
                />
              )}
              <div className="public-service-body">
                <h3>{svc.name_en}</h3>
                {svc.name_th && <p>{svc.name_th}</p>}
                {!isRestaurant && (
                  <p>
                    {svc.duration} minutes
                    {svc.gst_free ? ' · GST-free' : ''}
                  </p>
                )}
              </div>
              <span className="public-service-price">${Number(svc.price).toFixed(2)}</span>
            </article>
          ))}
        </div>
      )}

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to={withShopQuery('/book')} className="public-btn primary">
          {isRestaurant ? 'Order now' : 'Book now'}
        </Link>
      </p>
    </div>
  )
}
