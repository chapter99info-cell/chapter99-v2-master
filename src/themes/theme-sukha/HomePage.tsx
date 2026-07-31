import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const BG = 'https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=1800&q=80'

const CARDS = [
  { title: 'Today', value: '6 bookings' },
  { title: 'Next slot', value: '2:30 PM' },
  { title: 'Rating', value: '4.9 / 5' },
]

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const shopName = loading ? '…' : shop?.name || 'Sukha'

  return (
    <div style={{ minHeight: '100vh', position: 'relative', color: '#EAF6F3' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&display=swap');
        * { font-family: 'Inter', sans-serif; }
        .su-bg { position: fixed; inset: 0; z-index: -1; background-image: url(${BG}); background-size: cover; background-position: center; }
        .su-bg::after { content: ''; position: absolute; inset: 0; background: linear-gradient(160deg, rgba(11,31,28,0.88), rgba(11,31,28,0.7)); }
        .su-glass { background: rgba(255,255,255,0.07); backdrop-filter: blur(16px) saturate(140%); -webkit-backdrop-filter: blur(16px) saturate(140%); border: 1px solid rgba(255,255,255,0.14); border-radius: 20px; }
        .su-glass-strong { background: rgba(255,255,255,0.12); backdrop-filter: blur(22px) saturate(150%); -webkit-backdrop-filter: blur(22px) saturate(150%); border: 1px solid rgba(255,255,255,0.2); border-radius: 22px; }
        .su-stat:hover { background: rgba(255,255,255,0.11); }
      `}</style>
      <div className="su-bg" />

      <nav style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 44px' }}>
        <span style={{ fontSize: '19px', fontWeight: 600 }}>{shopName}</span>
        <div style={{ display: 'flex', gap: '10px' }}>
          <StaffLoginButton />
        </div>
      </nav>

      <header style={{ maxWidth: 900, margin: '40px auto 0', padding: '0 24px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', color: themeConfig.primaryColor, marginBottom: '14px' }}>
          Calm, in a glass
        </p>
        <h1 style={{ fontSize: '46px', fontWeight: 300, lineHeight: 1.2, margin: '0 0 20px' }}>
          Book your session,<br /><span style={{ fontWeight: 600 }}>see it clearly</span>
        </h1>
        <div className="su-glass-strong" style={{ display: 'inline-flex', gap: '10px', padding: '10px', marginTop: '10px' }}>
          <BookingButton />
          <POSLink />
        </div>
      </header>

      <section style={{ maxWidth: 960, margin: '70px auto', padding: '0 24px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {CARDS.map(c => (
          <div key={c.title} className="su-glass su-stat" style={{ padding: '24px', transition: 'background .25s ease' }}>
            <div style={{ fontSize: '12px', color: '#9FCFC4', marginBottom: '10px' }}>{c.title}</div>
            <div style={{ fontSize: '22px', fontWeight: 600 }}>{c.value}</div>
          </div>
        ))}
      </section>

      <section style={{ maxWidth: 960, margin: '0 auto 90px', padding: '0 24px' }}>
        <div className="su-glass" style={{ padding: '36px', position: 'relative' }}>
          <h2 style={{ fontSize: '22px', fontWeight: 600, margin: '0 0 12px' }}>Why {shopName}</h2>
          <p style={{ color: '#B9DBD3', lineHeight: 1.8, maxWidth: 600, margin: 0 }}>
            Every treatment is logged, every therapist is certified, and every booking runs through
            the same system your therapist uses at the front desk — no surprises, no double-bookings.
          </p>
        </div>
      </section>

      <footer style={{ padding: '40px 44px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && <p style={{ fontSize: '13px', color: '#7CA69C' }}>{shop.address} · {shop.phone}</p>}
      </footer>
    </div>
  )
}
