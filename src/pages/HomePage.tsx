import { Link } from 'react-router-dom'
import './PublicSite.css'

export default function HomePage() {
  return (
    <div className="public-page">
      <section className="public-hero">
        <p className="public-eyebrow">Traditional Thai Massage</p>
        <h1 className="public-hero-title">Mira Thai Massage</h1>
        <p className="public-hero-sub">
          Relax, restore, and recharge. Book your treatment online or visit us in person.
        </p>
        <div className="public-hero-actions">
          <Link to="/book" className="public-btn primary">
            Book now
          </Link>
          <Link to="/services" className="public-btn secondary">
            View services
          </Link>
        </div>
      </section>

      <section className="public-cards">
        <Link to="/book" className="public-card">
          <span className="public-card-icon">📅</span>
          <h2>Online booking</h2>
          <p>Choose your service, therapist, and time — confirmation by email.</p>
        </Link>
        <Link to="/voucher" className="public-card">
          <span className="public-card-icon">🎁</span>
          <h2>Gift vouchers</h2>
          <p>Give the gift of wellness — delivered by email.</p>
        </Link>
        <Link to="/about" className="public-card">
          <span className="public-card-icon">🌿</span>
          <h2>About us</h2>
          <p>Our story, location, and contact details.</p>
        </Link>
      </section>
    </div>
  )
}
