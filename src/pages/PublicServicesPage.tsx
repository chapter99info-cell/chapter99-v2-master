import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, SHOP_ID } from '../lib/supabase'
import './PublicSite.css'

interface ServiceRow {
  id: string
  name_en: string
  name_th: string | null
  duration: number
  price: number
  gst_free: boolean
}

export default function PublicServicesPage() {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('services')
      .select('id, name_en, name_th, duration, price, gst_free')
      .eq('shop_id', SHOP_ID)
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true })
      .then(({ data }) => {
        setServices((data as ServiceRow[]) ?? [])
        setLoading(false)
      })
  }, [])

  return (
    <div className="public-page">
      <h1 className="public-page-title">Our services</h1>
      <p className="public-page-lead">
        All treatments are performed by qualified therapists. Prices in AUD.
      </p>

      {loading ? (
        <p className="public-empty">Loading services…</p>
      ) : services.length === 0 ? (
        <p className="public-empty">Services coming soon.</p>
      ) : (
        <div className="public-service-list">
          {services.map(svc => (
            <article key={svc.id} className="public-service-item">
              <div>
                <h3>{svc.name_en}</h3>
                {svc.name_th && <p>{svc.name_th}</p>}
                <p>
                  {svc.duration} minutes
                  {svc.gst_free ? ' · GST-free' : ''}
                </p>
              </div>
              <span className="public-service-price">${Number(svc.price).toFixed(2)}</span>
            </article>
          ))}
        </div>
      )}

      <p style={{ marginTop: 24, textAlign: 'center' }}>
        <Link to="/book" className="public-btn primary">
          Book now
        </Link>
      </p>
    </div>
  )
}
