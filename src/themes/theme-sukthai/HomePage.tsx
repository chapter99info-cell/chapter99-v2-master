import { useEffect, useRef } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1800&q=80'

const RITUALS = [
  { name: 'Sen Line Stretch', desc: 'Traditional acupressure + assisted stretching', img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=700&q=80' },
  { name: 'Warm Oil Ritual', desc: 'Full body oil massage, slow and deliberate', img: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=700&q=80' },
  { name: 'Herbal Compress', desc: 'Steamed herbal pouches over deep tissue work', img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=700&q=80' },
  { name: 'Foot & Lower Leg', desc: 'Reflexology-focused close for every session', img: 'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=700&q=80' },
]

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const heroRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLDivElement>(null)

  // Lightweight scroll-driven parallax on the hero image — a simplified stand-in for a
  // full pinned scroll-rig, kept dependency-free and cheap to maintain per theme.
  useEffect(() => {
    function onScroll() {
      const hero = heroRef.current
      const img = imgRef.current
      if (!hero || !img) return
      const rect = hero.getBoundingClientRect()
      const progress = Math.min(1, Math.max(0, 1 - rect.bottom / (rect.height + window.innerHeight)))
      img.style.transform = `scale(${1 + progress * 0.15}) translateY(${progress * 30}px)`
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const shopName = loading ? '…' : shop?.name || 'Suk Thai Ritual'

  return (
    <div style={{ background: '#0F0B08', minHeight: '100vh', color: '#EDE6DC' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');
        .sk-serif { font-family: 'Cormorant Garamond', serif; }
        .sk-sans { font-family: 'Inter', sans-serif; }
        .sk-rail { display: flex; gap: 20px; overflow-x: auto; scroll-snap-type: x proximity; padding-bottom: 12px; }
        .sk-rail::-webkit-scrollbar { height: 6px; }
        .sk-rail::-webkit-scrollbar-thumb { background: rgba(237,230,220,0.2); border-radius: 4px; }
        .sk-card { scroll-snap-align: start; flex: 0 0 260px; }
        .sk-card img { width: 100%; height: 320px; object-fit: cover; border-radius: 12px; filter: brightness(.85); transition: filter .3s ease; }
        .sk-card:hover img { filter: brightness(1); }
      `}</style>

      <nav className="sk-sans" style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', justifyContent: 'space-between', padding: '24px 44px' }}>
        <span className="sk-serif" style={{ fontSize: '20px', color: themeConfig.primaryColor }}>{shopName}</span>
        <a href="#rituals" style={{ color: '#EDE6DC', fontSize: '13px', textDecoration: 'none', opacity: .8 }}>Rituals ↓</a>
      </nav>

      <header ref={heroRef} style={{ position: 'relative', height: '100vh', overflow: 'hidden' }}>
        <div
          ref={imgRef}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
            willChange: 'transform',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(15,11,8,0.2), rgba(15,11,8,0.85))' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 44px 90px' }}>
          <p className="sk-sans" style={{ color: themeConfig.primaryColor, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '16px' }}>
            A slow, deliberate ritual
          </p>
          <h1 className="sk-serif" style={{ fontSize: '68px', lineHeight: 1.05, margin: '0 0 24px', maxWidth: 680 }}>
            Every session, a full return to stillness
          </h1>
          <div style={{ display: 'flex', gap: '12px' }}>
            <BookingButton />
          </div>
        </div>
      </header>

      <section id="rituals" style={{ padding: '90px 44px' }}>
        <h2 className="sk-serif" style={{ fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9C8F7D', fontWeight: 400, marginBottom: '28px' }}>
          The Rituals
        </h2>
        <div className="sk-rail">
          {RITUALS.map(r => (
            <div key={r.name} className="sk-card">
              <img src={r.img} alt={r.name} loading="lazy" />
              <h3 className="sk-serif" style={{ fontSize: '22px', margin: '14px 0 6px' }}>{r.name}</h3>
              <p className="sk-sans" style={{ fontSize: '13px', color: '#9C8F7D', margin: 0 }}>{r.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="sk-sans" style={{ padding: '56px 44px', borderTop: '1px solid rgba(237,230,220,0.1)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && <p style={{ fontSize: '13px', color: '#7A7062' }}>{shop.address} · {shop.phone}</p>}
      </footer>
    </div>
  )
}
