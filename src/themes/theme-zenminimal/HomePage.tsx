import { useEffect, useRef } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const SERVICES = [
  { name: 'Traditional Thai Massage', duration: '60 / 90 min' },
  { name: 'Aromatherapy Oil Massage', duration: '60 min' },
  { name: 'Deep Tissue', duration: '60 / 90 min' },
  { name: 'Foot Reflexology', duration: '30 / 45 min' },
]

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const targets = root.querySelectorAll<HTMLElement>('[data-reveal]')
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('zm-in')
          io.unobserve(e.target)
        }
      }),
      { threshold: 0.15 }
    )
    targets.forEach(t => io.observe(t))
    return () => io.disconnect()
  }, [])

  const shopName = loading ? '…' : shop?.name || 'Lotus Thai Massage'

  return (
    <div ref={rootRef} style={{ background: '#FBFBF8', minHeight: '100vh', color: '#3D4438' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');
        .zm-serif { font-family: 'Cormorant Garamond', serif; }
        .zm-sans { font-family: 'Inter', sans-serif; }
        [data-reveal] { opacity: 0; transform: translateY(16px); transition: opacity 1s ease, transform 1s ease; }
        [data-reveal].zm-in { opacity: 1; transform: translateY(0); }
        .zm-line { width: 40px; height: 1px; background: ${themeConfig.primaryColor}; margin: 0 auto; }
        .zm-svc:hover { background: ${themeConfig.secondaryColor}; }
      `}</style>

      <nav className="zm-sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 48px' }}>
        <span className="zm-serif" style={{ fontSize: '22px', letterSpacing: '1px' }}>{shopName}</span>
        <div style={{ display: 'flex', gap: '28px', fontSize: '13px', color: '#5C6653' }}>
          <a href="#services" style={{ color: 'inherit', textDecoration: 'none' }}>Services</a>
          <a href="#philosophy" style={{ color: 'inherit', textDecoration: 'none' }}>Philosophy</a>
        </div>
      </nav>

      <header style={{ textAlign: 'center', padding: '100px 24px 80px' }}>
        <div data-reveal className="zm-line" style={{ marginBottom: '24px' }} />
        <h1 data-reveal className="zm-serif" style={{ fontSize: '52px', fontWeight: 400, margin: '0 0 20px', letterSpacing: '.5px' }}>
          Stillness, by design
        </h1>
        <p data-reveal className="zm-sans" style={{ maxWidth: 460, margin: '0 auto 36px', fontSize: '15px', lineHeight: 1.8, color: '#5C6653' }}>
          A quiet room, a trained hand, and nothing else competing for your attention.
        </p>
        <div data-reveal>
          <BookingButton />
        </div>
      </header>

      <section id="services" style={{ maxWidth: 640, margin: '0 auto', padding: '0 24px 100px' }}>
        {SERVICES.map(s => (
          <div
            key={s.name}
            data-reveal
            className="zm-svc zm-sans"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              padding: '20px 16px',
              borderBottom: '1px solid #E4E2D8',
              transition: 'background .3s ease',
            }}
          >
            <span className="zm-serif" style={{ fontSize: '20px' }}>{s.name}</span>
            <span style={{ fontSize: '13px', color: '#8A9280', alignSelf: 'center' }}>{s.duration}</span>
          </div>
        ))}
      </section>

      <section
        id="philosophy"
        data-reveal
        style={{ background: themeConfig.secondaryColor, padding: '90px 24px', textAlign: 'center' }}
      >
        <p className="zm-serif" style={{ fontSize: '26px', maxWidth: 560, margin: '0 auto', lineHeight: 1.5, fontStyle: 'italic' }}>
          "We treat every booking as forty-five minutes that belongs entirely to you."
        </p>
      </section>

      <footer style={{ padding: '56px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && (
          <p className="zm-sans" style={{ fontSize: '13px', color: '#8A9280' }}>{shop.address} · {shop.phone}</p>
        )}
      </footer>
    </div>
  )
}
