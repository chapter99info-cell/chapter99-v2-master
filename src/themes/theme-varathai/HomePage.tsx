import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

const PRODUCTS = [
  { name: 'Signature Oil Massage', price: '$95' },
  { name: 'Royal Thai Ritual', price: '$140' },
  { name: 'Hot Stone Therapy', price: '$110' },
]

function WordReveal({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const words = text.split(' ')
  return (
    <span className={className} style={style}>
      {words.map((w, i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            opacity: 0,
            animation: 'vt-word-in 0.7s ease forwards',
            animationDelay: `${0.15 + i * 0.09}s`,
          }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </span>
      ))}
    </span>
  )
}

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const shopName = loading ? '…' : shop?.name || 'Vara Thai'

  return (
    <div style={{ background: themeConfig.secondaryColor, minHeight: '100vh', color: '#EDEAE0' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Inter:wght@300;400;500&display=swap');
        @keyframes vt-word-in { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        .vt-serif { font-family: 'Cormorant Garamond', serif; }
        .vt-sans { font-family: 'Inter', sans-serif; }
        .vt-prod { border-top: 1px solid rgba(237,234,224,0.12); transition: background .3s ease; }
        .vt-prod:hover { background: rgba(201,162,39,0.06); }
      `}</style>

      <nav className="vt-sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '28px 48px' }}>
        <span className="vt-serif" style={{ fontSize: '22px', color: themeConfig.primaryColor, letterSpacing: '1px' }}>
          {shopName}
        </span>
        <div style={{ display: 'flex', gap: '28px', fontSize: '13px', color: '#B8B4A8' }}>
          <a href="#menu" style={{ color: 'inherit', textDecoration: 'none' }}>Menu</a>
          <a href="#contact" style={{ color: 'inherit', textDecoration: 'none' }}>Contact</a>
        </div>
      </nav>

      <header style={{ padding: '110px 48px 90px', maxWidth: 820 }}>
        <p className="vt-sans" style={{ color: themeConfig.primaryColor, fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', marginBottom: '20px' }}>
          Est. for those who notice detail
        </p>
        <h1 className="vt-serif" style={{ fontSize: '64px', lineHeight: 1.08, fontWeight: 500, margin: 0 }}>
          <WordReveal text="Massage, treated like craft." />
        </h1>
        <p className="vt-sans" style={{ marginTop: '28px', maxWidth: 480, color: '#B8B4A8', lineHeight: 1.8, fontSize: '15px' }}>
          {shopName} pairs traditional Thai technique with an unhurried, considered space —
          for guests who want the result, not just the hour.
        </p>
        <div style={{ marginTop: '36px' }}>
          <BookingButton />
        </div>
      </header>

      <section id="menu" style={{ padding: '0 48px 100px', maxWidth: 760 }}>
        <h2 className="vt-serif" style={{ fontSize: '13px', letterSpacing: '2px', textTransform: 'uppercase', color: '#B8B4A8', fontWeight: 400, marginBottom: '8px' }}>
          Signature Treatments
        </h2>
        {PRODUCTS.map(p => (
          <div key={p.name} className="vt-prod" style={{ display: 'flex', justifyContent: 'space-between', padding: '24px 8px' }}>
            <span className="vt-serif" style={{ fontSize: '26px' }}>{p.name}</span>
            <span className="vt-sans" style={{ fontSize: '15px', color: themeConfig.primaryColor, alignSelf: 'center' }}>{p.price}</span>
          </div>
        ))}
      </section>

      <footer id="contact" style={{ padding: '56px 48px', borderTop: '1px solid rgba(237,234,224,0.12)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && (
          <p className="vt-sans" style={{ fontSize: '13px', color: '#807C70' }}>{shop.address} · {shop.phone}</p>
        )}
      </footer>
    </div>
  )
}
