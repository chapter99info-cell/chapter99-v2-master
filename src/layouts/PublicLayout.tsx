import { Link, NavLink, Outlet } from 'react-router-dom'
import { ShopProvider, useShopContext } from '../contexts/ShopContext'
import './PublicLayout.css'

function PublicLayoutInner() {
  const { shop, loading, error, withShopQuery } = useShopContext()
  const shopName = shop?.name || 'Chapter99'
  const logoUrl = shop?.logoUrl

  return (
    <div className="public-site">
      <header className="public-header">
        <Link to={withShopQuery('/')} className="public-brand">
          {logoUrl ? (
            <img src={logoUrl} alt={shopName} className="public-logo" />
          ) : (
            <span className="public-logo-text">{loading ? '…' : shopName}</span>
          )}
        </Link>
        <nav className="public-nav" aria-label="Main">
          <NavLink
            to={withShopQuery('/')}
            end
            className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}
          >
            Home
          </NavLink>
          <NavLink
            to={withShopQuery('/book')}
            className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}
          >
            {shop?.businessType === 'restaurant' ? 'Order' : 'Book'}
          </NavLink>
          <NavLink
            to={withShopQuery('/services')}
            className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}
          >
            {shop?.businessType === 'restaurant' ? 'Menu' : 'Services'}
          </NavLink>
          <NavLink
            to={withShopQuery('/voucher')}
            className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}
          >
            Gift Vouchers
          </NavLink>
          <NavLink
            to={withShopQuery('/about')}
            className={({ isActive }) => `public-nav-link${isActive ? ' active' : ''}`}
          >
            About
          </NavLink>
          <Link to="/staff" className="public-nav-link public-nav-staff">
            Staff Login
          </Link>
        </nav>
      </header>

      {error && (
        <div className="public-banner-warn" role="alert">
          {error}
        </div>
      )}

      <main className="public-main">
        <Outlet />
      </main>

      <footer className="public-footer">
        <p>{shopName}</p>
        <p className="public-footer-links">
          <Link to={withShopQuery('/book')}>
            {shop?.businessType === 'restaurant' ? 'Order online' : 'Book online'}
          </Link>
          <span aria-hidden> · </span>
          <Link to="/staff">Staff dashboard</Link>
        </p>
      </footer>
    </div>
  )
}

export default function PublicLayout() {
  return (
    <ShopProvider>
      <PublicLayoutInner />
    </ShopProvider>
  )
}
