import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const HERO_IMAGE = 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=1400&q=80'
const THUMB_IMAGE = 'https://images.unsplash.com/photo-1591343395082-e120087004b4?w=700&q=80'

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const shopName = loading ? '…' : shop?.name || 'Orchid'

  return (
    <div style={{ minHeight: '100vh', background: themeConfig.secondaryColor, display: 'flex', flexWrap: 'wrap' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Inter:wght@400;500&display=swap');
        .og-serif { font-family: 'Cormorant Garamond', serif; }
        .og-sans { font-family: 'Inter', sans-serif; }
        .og-glass { backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); border-radius: 18px; }
        .og-glass-strong { backdrop-filter: blur(14px) saturate(140%); -webkit-backdrop-filter: blur(14px) saturate(140%); background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 22px; }
        .og-panel-left { flex: 1 1 52%; min-width: 320px; position: relative; padding: 44px; display: flex; flex-direction: column; min-height: 100vh; }
        .og-panel-right { flex: 1 1 48%; min-width: 320px; padding: 44px; display: flex; flex-direction: column; gap: 20px; }
        .og-pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; font-size: 12px; }
        @media (max-width: 900px) { .og-panel-left, .og-panel-right { flex: 1 1 100%; } }
      `}</style>

      <div className="og-panel-left" style={{ backgroundImage: `url(${HERO_IMAGE})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(26,26,26,0.35), rgba(26,26,26,0.75))' }} />
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
          <nav className="og-sans" style={{ display: 'flex', justifyContent: 'space-between', color: '#F4E9EC' }}>
            <span className="og-serif" style={{ fontSize: '20px' }}>{shopName}</span>
            <a href="#book" style={{ color: '#F4E9EC', textDecoration: 'none', fontSize: '13px', opacity: .85 }}>Book →</a>
          </nav>

          <div style={{ marginTop: 'auto' }}>
            <h1 className="og-serif" style={{ color: '#fff', fontSize: '48px', lineHeight: 1.15, fontStyle: 'italic', margin: '0 0 22px', maxWidth: 420 }}>
              Reviving the<br />art of stillness
            </h1>
            <div id="book" style={{ display: 'inline-block' }}>
              <BookingButton />
            </div>
            <div className="og-sans" style={{ display: 'flex', gap: '10px', marginTop: '22px', flexWrap: 'wrap' }}>
              {['Thai Massage', 'Oil Ritual', 'Hot Stone'].map(p => (
                <span key={p} className="og-glass og-pill" style={{ color: '#F4E9EC' }}>{p}</span>
              ))}
            </div>
            <div className="og-glass-strong og-serif" style={{ marginTop: '28px', padding: '20px 24px', color: '#F4E9EC', fontStyle: 'italic', fontSize: '16px', maxWidth: 380 }}>
              "The kind of quiet you can't get anywhere else in the city."
            </div>
          </div>
        </div>
      </div>

      <div className="og-panel-right og-sans" style={{ color: '#EDE4E7' }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <StaffLoginButton />
          <POSLink />
        </div>

        <div className="og-glass" style={{ padding: '24px' }}>
          <p style={{ fontSize: '12px', letterSpacing: '2px', textTransform: 'uppercase', color: themeConfig.primaryColor, marginBottom: '10px' }}>
            Community
          </p>
          <p style={{ lineHeight: 1.7, color: '#C9BCC0', margin: 0, fontSize: '14px' }}>
            {shopName} is trusted by regulars who book the same therapist, same time, every week —
            because consistency is most of what makes a massage actually work.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="og-glass" style={{ padding: '20px' }}>
            <div style={{ fontSize: '28px', fontWeight: 600 }}>60+</div>
            <div style={{ fontSize: '12px', color: '#C9BCC0', marginTop: '6px' }}>Minutes per ritual</div>
          </div>
          <div className="og-glass" style={{ padding: '20px' }}>
            <div style={{ fontSize: '28px', fontWeight: 600 }}>100%</div>
            <div style={{ fontSize: '12px', color: '#C9BCC0', marginTop: '6px' }}>Certified therapists</div>
          </div>
        </div>

        <div className="og-glass" style={{ padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
          <img src={THUMB_IMAGE} alt="Treatment room" style={{ width: 72, height: 72, borderRadius: 14, objectFit: 'cover' }} />
          <div>
            <div style={{ fontWeight: 500, fontSize: '15px' }}>Signature Oil Ritual</div>
            <div style={{ fontSize: '12px', color: '#C9BCC0', marginTop: '4px' }}>60 / 90 min · Book online</div>
          </div>
        </div>

        <div style={{ marginTop: 'auto', fontSize: '13px', color: '#8F8388' }}>
          {!loading && shop && <p style={{ margin: 0 }}>{shop.address} · {shop.phone}</p>}
        </div>
      </div>
    </div>
  )
}
