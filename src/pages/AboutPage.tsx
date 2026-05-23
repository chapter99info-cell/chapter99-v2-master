import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import './PublicSite.css'

export default function AboutPage() {
  const { shop, loading, withShopQuery, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const defaultLead = isRestaurant
    ? 'Fresh food and warm hospitality.'
    : 'Authentic Thai massage in a calm, professional setting.'
  const lead = shop?.aboutText?.trim() || defaultLead
  const phone = shop?.aboutPhone?.trim() || shop?.phone
  const address = shop?.aboutAddress?.trim() || shop?.address
  const mapsUrl = shop?.googleMapsUrl?.trim()

  return (
    <div className="public-page">
      <h1 className="public-page-title">About {shop?.name ?? (loading ? '…' : 'Us')}</h1>
      <p className="public-page-lead">{lead}</p>

      <div className="public-info-card">
        {address && (
          <p>
            <strong>Address:</strong>{' '}
            {mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noreferrer">
                {address}
              </a>
            ) : (
              address
            )}
          </p>
        )}
        {phone && (
          <p>
            <strong>Phone:</strong>{' '}
            <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
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
        {mapsUrl && !address && (
          <p>
            <a href={mapsUrl} target="_blank" rel="noreferrer" className="public-btn secondary">
              View on Google Maps
            </a>
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
