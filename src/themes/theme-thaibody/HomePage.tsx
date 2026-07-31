import { useEffect, useRef } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

// Gallery images — royalty-free Unsplash photos (safe to hotlink), not the shop's real photos.
const GALLERY = [
  'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80',
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=800&q=80',
  'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=800&q=80',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=800&q=80',
  'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=800&q=80',
  'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80',
]

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('tb-in')
            io.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.15 }
    )
    targets.forEach(t => io.observe(t))
    return () => io.disconnect()
  }, [])

  const shopName = loading ? '…' : shop?.name || 'Thai Body'

  return (
    <div ref={rootRef} className="tb-root" style={{ background: '#FAF3EC', minHeight: '100vh' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,600;1,500&family=Inter:wght@400;500&display=swap');
        .tb-root { font-family: 'Inter', sans-serif; color: #3A2A20; overflow-x: hidden; }
        .tb-root [data-reveal] { opacity: 0; transform: translateY(24px); transition: opacity .8s ease, transform .8s ease; }
        .tb-root [data-reveal].tb-in { opacity: 1; transform: translateY(0); }
        .tb-hero-title { font-family: 'Playfair Display', serif; }
        .tb-card { position: relative; overflow: hidden; border-radius: 16px; }
        .tb-card img { display: block; width: 100%; height: 100%; object-fit: cover; transition: transform .6s ease; }
        .tb-card:hover img { transform: scale(1.08); }
        .tb-nav a { color: #3A2A20; text-decoration: none; font-size: 14px; opacity: .8; }
        .tb-nav a:hover { opacity: 1; }
        @media (max-width: 720px) {
          .tb-mosaic { grid-template-columns: repeat(2, 1fr) !important; }
          .tb-hero-title { font-size: 40px !important; }
        }
      `}</style>

      {/* Nav */}
      <nav
        className="tb-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '20px 40px',
          position: 'sticky',
          top: 0,
          zIndex: 20,
          background: 'rgba(250,243,236,0.85)',
          backdropFilter: 'blur(8px)',
        }}
      >
        <span className="tb-hero-title" style={{ fontSize: '20px', fontWeight: 600 }}>
          {shopName}
        </span>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
          <a href="#treatments">Treatments</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </div>
      </nav>

      {/* Hero */}
      <header style={{ padding: '80px 40px 60px', maxWidth: 880, margin: '0 auto', textAlign: 'center' }}>
        <p
          data-reveal
          style={{ letterSpacing: '3px', textTransform: 'uppercase', fontSize: '12px', color: themeConfig.primaryColor, marginBottom: '16px' }}
        >
          Traditional Thai Bodywork
        </p>
        <h1
          data-reveal
          className="tb-hero-title"
          style={{ fontSize: '58px', lineHeight: 1.1, fontWeight: 500, margin: '0 0 24px' }}
        >
          Restore balance,<br />one touch at a time
        </h1>
        <p data-reveal style={{ fontSize: '17px', lineHeight: 1.7, color: '#6B5A4E', maxWidth: 520, margin: '0 auto 32px' }}>
          {shopName} blends generations-old Thai massage technique with a calm, considered space —
          built for real recovery, not just relaxation.
        </p>
        <div data-reveal style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <BookingButton />
        </div>
      </header>

      {/* Masked mosaic gallery */}
      <section id="treatments" style={{ padding: '20px 40px 100px', maxWidth: 1100, margin: '0 auto' }}>
        <div
          className="tb-mosaic"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: '160px',
            gap: '12px',
          }}
        >
          {GALLERY.map((src, i) => (
            <div
              key={src}
              data-reveal
              className="tb-card"
              style={{ gridRow: i % 3 === 0 ? 'span 2' : 'span 1' }}
            >
              <img src={src} alt="Thai massage treatment" loading="lazy" />
            </div>
          ))}
        </div>
      </section>

      {/* About */}
      <section
        id="about"
        data-reveal
        style={{
          background: themeConfig.secondaryColor,
          padding: '72px 40px',
          textAlign: 'center',
        }}
      >
        <h2 className="tb-hero-title" style={{ fontSize: '32px', margin: '0 0 16px' }}>
          Trained hands. Considered pressure.
        </h2>
        <p style={{ maxWidth: 560, margin: '0 auto', color: '#6B5A4E', lineHeight: 1.7 }}>
          Every therapist at {shopName} is fully certified in traditional Thai massage, deep tissue
          and oil techniques — so every booking gets the pressure and pacing it actually needs.
        </p>
      </section>

      {/* Contact / core actions */}
      <footer
        id="contact"
        data-reveal
        style={{
          padding: '56px 40px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && (
          <p style={{ fontSize: '13px', color: '#8A7768' }}>
            {shop.address} · {shop.phone}
          </p>
        )}
      </footer>
    </div>
  )
}
