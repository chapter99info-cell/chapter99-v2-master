import { useState } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const MOODS = [
  { name: 'Golden Hour', img: 'https://images.unsplash.com/photo-1600334129128-685c5582fd35?w=1800&q=80', dark: false },
  { name: 'Still Water', img: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1800&q=80', dark: false },
  { name: 'Deep Woods', img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1800&q=80', dark: true },
  { name: 'Quiet Dawn', img: 'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=1800&q=80', dark: false },
]

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const [mood, setMood] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)

  const current = MOODS[mood]
  const shopName = loading ? '…' : shop?.name || 'Solene'
  const textColor = current.dark ? '#EAF0F6' : '#2C2620'
  const glassBorder = current.dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.5)'

  return (
    <div style={{ minHeight: '100vh', position: 'relative', color: textColor, transition: 'color .6s ease' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@400;500&display=swap');
        .sl-serif { font-family: 'Cormorant Garamond', serif; }
        .sl-sans { font-family: 'Inter', sans-serif; }
        .sl-bg-layer { position: fixed; inset: 0; z-index: -2; background-size: cover; background-position: center; opacity: 0; transition: opacity 1s ease; }
        .sl-bg-layer.active { opacity: 1; }
        .sl-overlay { position: fixed; inset: 0; z-index: -1; transition: background 1s ease; }
        .sl-glass { backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); background: rgba(255,255,255,0.08); border-radius: 18px; position: relative; }
        .sl-glass::before { content: ''; position: absolute; inset: 0; border-radius: 18px; padding: 1px; background: linear-gradient(135deg, ${glassBorder}, transparent 60%); -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0); -webkit-mask-composite: xor; mask-composite: exclude; pointer-events: none; }
        .sl-mood-dot { width: 10px; height: 10px; border-radius: 50%; cursor: pointer; border: 1px solid currentColor; opacity: .5; transition: opacity .3s ease, transform .3s ease; }
        .sl-mood-dot.active { opacity: 1; transform: scale(1.3); }
      `}</style>

      {MOODS.map((m, i) => (
        <div key={m.name} className={`sl-bg-layer${i === mood ? ' active' : ''}`} style={{ backgroundImage: `url(${m.img})` }} />
      ))}
      <div className="sl-overlay" style={{ background: current.dark ? 'rgba(24,44,65,0.55)' : 'rgba(255,255,255,0.35)' }} />

      <nav className="sl-sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '26px 44px' }}>
        <span className="sl-serif" style={{ fontSize: '21px' }}>{shopName}</span>
        <div style={{ display: 'none' }} />
        <button
          className="sl-sans"
          onClick={() => setMenuOpen(o => !o)}
          style={{ background: 'transparent', border: `1px solid ${textColor}55`, color: textColor, borderRadius: '999px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer' }}
        >
          Menu
        </button>
      </nav>

      {menuOpen && (
        <div className="sl-glass sl-sans" style={{ position: 'fixed', top: 76, right: 44, zIndex: 30, padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 160 }}>
          <a href="#book" style={{ color: textColor, textDecoration: 'none' }}>Book now</a>
          <a href="#moods" style={{ color: textColor, textDecoration: 'none' }}>Moods</a>
        </div>
      )}

      <header style={{ minHeight: '78vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 44px', maxWidth: 640 }}>
        <p className="sl-sans" style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '18px' }}>
          {current.name}
        </p>
        <h1 className="sl-serif" style={{ fontSize: '54px', lineHeight: 1.15, margin: '0 0 22px' }}>
          A mood for every visit
        </h1>
        <p className="sl-sans" style={{ maxWidth: 440, lineHeight: 1.8, marginBottom: '30px', opacity: .9 }}>
          {shopName} — pick the atmosphere, we'll match the treatment.
        </p>
        <div id="book" className="sl-glass" style={{ display: 'inline-flex', gap: '10px', padding: '10px', width: 'fit-content' }}>
          <BookingButton />
        </div>
      </header>

      <section id="moods" style={{ display: 'flex', gap: '14px', padding: '0 44px 90px' }}>
        {MOODS.map((m, i) => (
          <div
            key={m.name}
            className="sl-mood-dot-wrap sl-sans"
            onClick={() => setMood(i)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}
          >
            <span className={`sl-mood-dot${mood === i ? ' active' : ''}`} />
            {m.name}
          </div>
        ))}
      </section>

      <footer className="sl-sans" style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && <p style={{ fontSize: '13px', opacity: .75 }}>{shop.address} · {shop.phone}</p>}
      </footer>
    </div>
  )
}
