import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchShop } from '../lib/shopService'
import { SHOP_ID } from '../lib/supabase'
import './PublicSite.css'

export default function AboutPage() {
  const [shop, setShop] = useState<Awaited<ReturnType<typeof fetchShop>> | null>(null)

  useEffect(() => {
    fetchShop(SHOP_ID).then(setShop)
  }, [])

  return (
    <div className="public-page">
      <h1 className="public-page-title">About {shop?.name ?? 'Mira Thai Massage'}</h1>
      <p className="public-page-lead">
        Authentic Thai massage in a calm, professional setting.
      </p>

      <div className="public-info-card">
        {shop?.address && (
          <p>
            <strong>Address:</strong> {shop.address}
          </p>
        )}
        {shop?.phone && (
          <p>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${shop.phone.replace(/\s/g, '')}`}>{shop.phone}</a>
          </p>
        )}
        {shop?.email && (
          <p>
            <strong>Email:</strong>{' '}
            <a href={`mailto:${shop.email}`}>{shop.email}</a>
          </p>
        )}
        {shop?.abn && (
          <p>
            <strong>ABN:</strong> {shop.abn}
          </p>
        )}
        <p>
          <Link to="/book" className="public-btn primary" style={{ marginTop: 12, display: 'inline-block' }}>
            Book an appointment
          </Link>
        </p>
      </div>
    </div>
  )
}
