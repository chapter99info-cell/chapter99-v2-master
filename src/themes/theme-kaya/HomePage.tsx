import { useEffect, useRef, useState } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const BENTO = [
  { img: 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=900&q=80', label: 'Traditional Thai', big: true },
  { img: 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=700&q=80', label: 'Hot Stone', big: false },
  { img: 'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=700&q=80', label: 'Reflexology', big: false },
  { img: 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=900&q=80', label: 'Oil Massage', big: true },
]

const STATS = [
  { value: 12, suffix: 'yrs', label: 'In business' },
  { value: 8000, suffix: '+', label: 'Sessions delivered' },
  { value: 4.9, suffix: '★', label: 'Average rating' },
]

function useCountUp(target: number, active: boolean) {
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf: number
    const start = performance.now()
    const duration = 1200
    function tick(now: number) {
      const p = Math.min(1, (now - start) / duration)
      setN(target * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, target])
  return n
}

function StatBlock({ value, suffix, label }: { value: number; suffix: string; label: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setActive(true)
        io.disconnect()
      }
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const n = useCountUp(value, active)
  const display = value < 10 && value % 1 !== 0 ? n.toFixed(1) : Math.round(n).toLocaleString()
  return (
    <div ref={ref} style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '44px', fontWeight: 600 }}>{display}{suffix}</div>
      <div style={{ fontSize: '12px', color: '#8A8A8A', marginTop: '6px' }}>{label}</div>
    </div>
  )
}

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const [ready, setReady] = useState(false)
  const [count, setCount] = useState(0)

  // Boot-up loading counter, 0 -> 100
  useEffect(() => {
    if (ready) return
    const iv = setInterval(() => {
      setCount(c => {
        if (c >= 100) {
          clearInterval(iv)
          setTimeout(() => setReady(true), 250)
          return 100
        }
        return c + 4
      })
    }, 18)
    return () => clearInterval(iv)
  }, [ready])

  const shopName = loading ? '…' : shop?.name || 'Kaya Thai Studio'

  return (
    <div style={{ background: themeConfig.secondaryColor, minHeight: '100vh', color: themeConfig.primaryColor, position: 'relative' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .ky-loader { position: fixed; inset: 0; background: #111; display: flex; align-items: center; justify-content: center; z-index: 50; transition: opacity .5s ease, visibility .5s ease; }
        .ky-loader.hide { opacity: 0; visibility: hidden; pointer-events: none; }
        .ky-pill { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 30; display: flex; gap: 24px; align-items: center; background: rgba(255,255,255,0.06); backdrop-filter: blur(10px); border: 1px solid rgba(255,255,255,0.08); border-radius: 999px; padding: 10px 22px; }
        .ky-pill a { color: #E8DCC8; opacity: .7; text-decoration: none; font-size: 13px; }
        .ky-pill a:hover { opacity: 1; }
        .ky-bento-item { position: relative; overflow: hidden; border-radius: 14px; }
        .ky-bento-item img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s ease; }
        .ky-bento-item:hover img { transform: scale(1.06); }
        .ky-bento-label { position: absolute; bottom: 14px; left: 16px; color: #fff; font-size: 14px; font-weight: 500; text-shadow: 0 2px 8px rgba(0,0,0,0.5); }
        .ky-marquee { display: flex; white-space: nowrap; animation: ky-scroll 22s linear infinite; }
        @keyframes ky-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
      `}</style>

      <div className={`ky-loader${ready ? ' hide' : ''}`}>
        <span style={{ fontSize: '15px', letterSpacing: '3px', color: '#E8DCC8' }}>{String(count).padStart(3, '0')}</span>
      </div>

      <nav className="ky-pill">
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{shopName}</span>
        <a href="#work">Treatments</a>
        <a href="#stats">About</a>
      </nav>

      <header style={{ padding: '170px 44px 80px', maxWidth: 780 }}>
        <h1 style={{ fontSize: '56px', fontWeight: 300, lineHeight: 1.15, margin: '0 0 24px' }}>
          Modern studio.<br /><span style={{ fontWeight: 600 }}>Traditional hands.</span>
        </h1>
        <p style={{ color: '#8A8A8A', maxWidth: 440, lineHeight: 1.7, marginBottom: '32px' }}>
          {shopName} — a considered space for traditional Thai bodywork, run by fully certified therapists.
        </p>
        <BookingButton />
      </header>

      <section id="work" style={{ padding: '0 44px 90px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridAutoRows: '200px', gap: '14px' }}>
          {BENTO.map((b, i) => (
            <div
              key={i}
              className="ky-bento-item"
              style={{ gridColumn: b.big ? 'span 2' : 'span 1', gridRow: b.big ? 'span 2' : 'span 1' }}
            >
              <img src={b.img} alt={b.label} loading="lazy" />
              <span className="ky-bento-label">{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="stats" style={{ display: 'flex', justifyContent: 'center', gap: '80px', padding: '60px 44px', flexWrap: 'wrap' }}>
        {STATS.map(s => (
          <StatBlock key={s.label} {...s} />
        ))}
      </section>

      <div style={{ overflow: 'hidden', borderTop: '1px solid rgba(255,255,255,0.08)', padding: '20px 0' }}>
        <div className="ky-marquee" style={{ fontSize: '13px', color: '#4A4A4A' }}>
          {Array(2).fill(0).map((_, i) => (
            <span key={i} style={{ paddingRight: '48px' }}>
              BOOK ONLINE — TRADITIONAL THAI MASSAGE — DEEP TISSUE — HOT STONE — REFLEXOLOGY —{' '}
            </span>
          ))}
        </div>
      </div>

      <footer style={{ padding: '48px 44px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && <p style={{ fontSize: '13px', color: '#5A5A5A' }}>{shop.address} · {shop.phone}</p>}
      </footer>
    </div>
  )
}
