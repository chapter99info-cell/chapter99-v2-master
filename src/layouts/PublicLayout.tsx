import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet } from 'react-router-dom'
import { fetchShop } from '../lib/shopService'
import { SHOP_ID } from '../lib/supabase'
import './PublicLayout.css'

export default function PublicLayout() {
  const [shopName, setShopName] = useState('Mira Thai Massage')
  const [logoUrl, setLogoUrl] = useState<string | undefined>()

  useEffect(() => {
    fetchShop(SHOP_ID).then(shop => {
      setShopName(shop.name || 'Mira Thai Massage')
      setLogoUrl(shop.logoUrl)
    })
  }, [])

  return (
    <div className="public-site">
      <header className="public-header">
        <Link to="/" className="public-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={shopName} className="public-logo" />
          ) : (
            <span className="public-logo-text">{shopName}</span>
          )}
        </Link>
        <nav className="public-nav" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}>
            Home
          </NavLink>
          <NavLink to="/book" className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}>
            Book
          </NavLink>
          <NavLink to="/services" className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}>
            Services
          </NavLink>
          <NavLink to="/voucher" className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}>
            Gift Vouchers
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}>
            About
          </NavLink>
          <Link to="/staff" className="public-nav-link public-nav-staff">
            Staff Login
          </Link>
        </nav>
      </header>

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="public-footer">
        <p>{shopName}</p>
        <p className="public-footer-links">
          <Link to="/book">Book online</Link>
          <span aria-hidden> · </span>
          <Link to="/staff">Staff dashboard</Link>
        </p>
      </footer>
    </div>
  )
}
