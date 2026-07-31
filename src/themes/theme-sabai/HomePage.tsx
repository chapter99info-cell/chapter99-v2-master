import { useEffect, useRef, useState } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const FEATURES = [
  { title: 'Book in under a minute', desc: 'Pick a service, pick a time, done — no account required.' },
  { title: 'Real therapists, real availability', desc: 'What you see online is what the front desk sees too.' },
  { title: 'Gentle reminders', desc: 'A friendly nudge before your session so you never miss it.' },
]

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeFeature, setActiveFeature] = useState(0)
  const cardsRef = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    const io = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = cardsRef.current.findIndex(el => el === entry.target)
            if (idx >= 0) setActiveFeature(idx)
          }
        })
      },
      { threshold: 0.5 }
    )
    cardsRef.current.forEach(el => el && io.observe(el))
    return () => io.disconnect()
  }, [])

  const shopName = loading ? '…' : shop?.name || 'Sabai.'

  return (
    <div style={{ background: themeConfig.secondaryColor, minHeight: '100vh', color: '#3B3A32' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz@1,9..144&family=Inter:wght@400;500&display=swap');
        .sb-italic { font-family: 'Fraunces', serif; font-style: italic; }
        .sb-sans { font-family: 'Inter', sans-serif; }
        .sb-pill { position: sticky; top: 20px; z-index: 20; margin: 0 auto 40px; max-width: 720px; display: flex; justify-content: space-between; align-items: center; background: #fff; border-radius: 999px; padding: 12px 20px; box-shadow: 0 8px 24px rgba(0,0,0,0.06); }
        .sb-burger { display: flex; flex-direction: column; gap: 4px; cursor: pointer; background: none; border: none; padding: 6px; }
        .sb-burger span { width: 18px; height: 2px; background: #3B3A32; border-radius: 2px; transition: transform .25s ease, opacity .25s ease; }
        .sb-burger.open span:nth-child(1) { transform: translateY(6px) rotate(45deg); }
        .sb-burger.open span:nth-child(2) { opacity: 0; }
        .sb-burger.open span:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
        .sb-dropdown { max-height: 0; overflow: hidden; transition: max-height .3s ease; }
        .sb-dropdown.open { max-height: 160px; }
        .sb-feature-card { padding: 28px; border-radius: 16px; transition: background .3s ease, transform .3s ease; }
        .sb-feature-card.active { background: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.05); }
      `}</style>

      <div className="sb-pill sb-sans">
        <span className="sb-italic" style={{ fontSize: '19px' }}>{shopName}</span>
        <button className={`sb-burger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </div>
      <div className={`sb-dropdown sb-sans${menuOpen ? ' open' : ''}`} style={{ maxWidth: 720, margin: '-30px auto 0', textAlign: 'center' }}>
        <div style={{ background: '#fff', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <a href="#features" style={{ color: '#3B3A32', textDecoration: 'none' }}>How it works</a>
          <a href="#about" style={{ color: '#3B3A32', textDecoration: 'none' }}>About</a>
        </div>
      </div>

      <header style={{ textAlign: 'center', padding: '60px 24px 80px' }}>
        <h1 className="sb-sans" style={{ fontSize: '48px', fontWeight: 400, lineHeight: 1.2, margin: '0 0 20px' }}>
          Booking that feels <span className="sb-italic">effortless</span>
        </h1>
        <p className="sb-sans" style={{ maxWidth: 440, margin: '0 auto 32px', color: '#6E6C5F', lineHeight: 1.7 }}>
          {shopName} keeps things simple — pick a time, walk in, feel better. No clutter, no confusion.
        </p>
        <BookingButton />
      </header>

      <section id="about" className="sb-sans" style={{ maxWidth: 640, margin: '0 auto', background: '#fff', borderRadius: '28px', padding: '48px 40px', textAlign: 'center', marginBottom: '70px', boxShadow: '0 20px 50px rgba(0,0,0,0.05)' }}>
        <p className="sb-italic" style={{ fontSize: '22px', color: themeConfig.primaryColor, marginBottom: '8px' }}>About us</p>
        <p style={{ color: '#6E6C5F', lineHeight: 1.8, margin: 0 }}>
          We built {shopName} around one idea: your time off shouldn't require effort to plan. Certified
          therapists, honest pricing, and a booking flow that gets out of your way.
        </p>
      </section>

      <section id="features" style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 100px', display: 'flex', gap: '32px', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 200px', position: 'sticky', top: '120px', alignSelf: 'flex-start' }}>
          <p className="sb-sans" style={{ fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: '#9A9887' }}>
            Step {activeFeature + 1} of {FEATURES.length}
          </p>
          <h2 className="sb-italic" style={{ fontSize: '28px', marginTop: '8px' }}>{FEATURES[activeFeature].title}</h2>
        </div>
        <div style={{ flex: '2 1 320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              ref={el => { cardsRef.current[i] = el }}
              className={`sb-feature-card sb-sans${activeFeature === i ? ' active' : ''}`}
            >
              <h3 style={{ margin: '0 0 8px', fontSize: '17px' }}>{f.title}</h3>
              <p style={{ margin: 0, color: '#6E6C5F', lineHeight: 1.6, fontSize: '14px' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="sb-sans" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && <p style={{ fontSize: '13px', color: '#9A9887' }}>{shop.address} · {shop.phone}</p>}
      </footer>
    </div>
  )
}
