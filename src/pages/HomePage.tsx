import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import './PublicSite.css'

export default function HomePage() {
  const { shop, loading, withShopQuery, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.name || (loading ? '…' : 'Welcome')

  return (
    <div className="public-page">
      <section className="public-hero">
        <p className="public-eyebrow">
          {isRestaurant ? 'Dine with us' : 'Traditional Thai Massage'}
        </p>
        <h1 className="public-hero-title">{name}</h1>
        <p className="public-hero-sub">
          {isRestaurant
            ? 'Order online for pickup or delivery, or visit us in person.'
            : 'Relax, restore, and recharge. Book your treatment online or visit us in person.'}
        </p>
        <div className="public-hero-actions">
          <Link to={withShopQuery('/book')} className="public-btn primary">
            {isRestaurant ? 'Order now' : 'Book now'}
          </Link>
          <Link to={withShopQuery('/services')} className="public-btn secondary">
            {isRestaurant ? 'View menu' : 'View services'}
          </Link>
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
        <Link to={withShopQuery('/voucher')} className="public-card">
          <span className="public-card-icon">🎁</span>
          <h2>Gift vouchers</h2>
          <p>Give the gift of wellness — delivered by email.</p>
        </Link>
        <Link to={withShopQuery('/about')} className="public-card">
          <span className="public-card-icon">🌿</span>
          <h2>About us</h2>
          <p>Our story, location, and contact details.</p>
        </Link>
      </section>
    </div>
  )
}
