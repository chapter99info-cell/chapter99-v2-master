import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import { useShopPages } from '../hooks/useShopPages'
import './PublicSite.css'

export default function HomePage() {
  const { shop, loading, withShopQuery, businessType } = useShopContext()
  const { pageServicesEnabled, pageVouchersEnabled, pageAboutEnabled } = useShopPages()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Welcome')
  const defaultSub = isRestaurant
    ? 'Order online for pickup or delivery, or visit us in person.'
    : 'Relax, restore, and recharge. Book your treatment online or visit us in person.'
  const subtitle = shop?.heroSubtitle?.trim() || defaultSub

  const heroImage = shop?.heroImageUrl?.trim()

  return (
    <div className="public-page">
      <section
        className={`public-hero${heroImage ? ' public-hero--image' : ''}`}
        style={
          heroImage
            ? {
                backgroundImage: `linear-gradient(rgba(26, 61, 43, 0.55), rgba(26, 61, 43, 0.7)), url(${heroImage})`,
              }
            : undefined
        }
      >
        <p className="public-eyebrow">
          {isRestaurant ? 'Dine with us' : 'Traditional Thai Massage'}
        </p>
        <h1 className="public-hero-title">{name}</h1>
        <p className="public-hero-sub">{subtitle}</p>
        <div className="public-hero-actions">
          <Link to={withShopQuery('/book')} className="public-btn primary">
            {isRestaurant ? 'Order now' : 'Book now'}
          </Link>
          {pageServicesEnabled && (
            <Link to={withShopQuery('/services')} className="public-btn secondary">
              {isRestaurant ? 'View menu' : 'View services'}
            </Link>
          )}
        </div>
      </section>

      <section className="public-cards">
        <Link to={withShopQuery('/book')} className="public-card">
          <span className="public-card-icon">{isRestaurant ? '🍽️' : '📅'}</span>
          <h2>{isRestaurant ? 'Online ordering' : 'Online booking'}</h2>
          <p>
            {isRestaurant
              ? 'Browse the menu and place your order — confirmation by email.'
              : 'Choose your service, therapist, and time — confirmation by email.'}
          </p>
        </Link>
        {pageVouchersEnabled && (
          <Link to={withShopQuery('/voucher')} className="public-card">
            <span className="public-card-icon">🎁</span>
            <h2>Gift vouchers</h2>
            <p>Give the gift of wellness — delivered by email.</p>
          </Link>
        )}
        {pageAboutEnabled && (
          <Link to={withShopQuery('/about')} className="public-card">
            <span className="public-card-icon">🌿</span>
            <h2>About us</h2>
            <p>Our story, location, and contact details.</p>
          </Link>
        )}
      </section>
    </div>
  )
}
