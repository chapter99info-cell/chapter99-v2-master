import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import './PublicSite.css'

export default function AboutPage() {
  const { shop, loading, withShopQuery, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'

  return (
    <div className="public-page">
      <h1 className="public-page-title">About {shop?.name ?? (loading ? '…' : 'Us')}</h1>
      <p className="public-page-lead">
        {isRestaurant
          ? 'Fresh food and warm hospitality.'
          : 'Authentic Thai massage in a calm, professional setting.'}
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
          <Link
            to={withShopQuery('/book')}
            className="public-btn primary"
            style={{ marginTop: 12, display: 'inline-block' }}
          >
            {isRestaurant ? 'Order now' : 'Book an appointment'}
          </Link>
        </p>
      </div>
    </div>
  )
}
