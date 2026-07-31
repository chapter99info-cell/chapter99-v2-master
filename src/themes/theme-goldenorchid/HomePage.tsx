import { useState } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import { themeConfig } from './theme.config'

// Ken-burns hero background — royalty-free Unsplash photo (CSS-animated zoom substitutes for
// a hotlinked stock video, which we avoid using since we don't hold a license for one).
const HERO_IMAGE = 'https://images.unsplash.com/photo-1596178060810-72660ec93a2a?w=1600&q=80'

const SERVICE_TAGS = ['Thai Massage', 'Oil Massage', 'Foot Reflexology', 'Hot Stone', 'Deep Tissue']

export default function HomePage() {
  const { shop, loading } = useShopContext()
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const shopName = loading ? '…' : shop?.name || 'Golden Orchid Thai Massage'

  function toggleTag(tag: string) {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Front-end enquiry form only — not wired to a backend/CRM yet. Real bookings go
    // through BookingButton -> /book, which is the flow connected to Supabase.
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setSubmitted(true)
    }, 700)
  }

  return (
    <div style={{ background: '#FFFDFB', minHeight: '100vh', color: '#3A2E28' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;600&family=Inter:wght@400;500&display=swap');
        @keyframes go-kenburns { 0% { transform: scale(1) translate(0,0); } 100% { transform: scale(1.15) translate(-1%, -1%); } }
        .go-serif { font-family: 'Playfair Display', serif; }
        .go-sans { font-family: 'Inter', sans-serif; }
        .go-hero-bg { animation: go-kenburns 18s ease-in-out infinite alternate; }
        .go-tag { transition: all .2s ease; cursor: pointer; }
        .go-tag.selected { background: ${themeConfig.primaryColor} !important; color: #fff !important; border-color: ${themeConfig.primaryColor} !important; }
      `}</style>

      <nav className="go-sans" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px 44px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <span className="go-serif" style={{ fontSize: '20px', color: '#fff', fontWeight: 600 }}>{shopName}</span>
        <a href="#enquire" className="go-sans" style={{ color: '#fff', fontSize: '13px', textDecoration: 'none', border: '1px solid rgba(255,255,255,0.6)', padding: '8px 16px', borderRadius: '999px' }}>
          Enquire
        </a>
      </nav>

      {/* Ken-burns hero */}
      <header style={{ position: 'relative', height: '70vh', minHeight: 480, overflow: 'hidden' }}>
        <div
          className="go-hero-bg"
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `url(${HERO_IMAGE})`,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35), rgba(0,0,0,0.55))' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 24px' }}>
          <h1 className="go-serif" style={{ color: '#fff', fontSize: '52px', fontWeight: 600, margin: '0 0 16px', lineHeight: 1.15 }}>
            A golden hour,<br />just for you
          </h1>
          <p className="go-sans" style={{ color: '#F3E7DA', maxWidth: 420, marginBottom: '28px' }}>
            {shopName} — traditional Thai touch in a warm, unhurried setting.
          </p>
          <BookingButton />
        </div>
      </header>

      {/* Enquiry form */}
      <section id="enquire" style={{ maxWidth: 560, margin: '0 auto', padding: '80px 24px' }}>
        <h2 className="go-serif" style={{ fontSize: '30px', textAlign: 'center', marginBottom: '8px' }}>Tell us what you need</h2>
        <p className="go-sans" style={{ textAlign: 'center', color: '#8A7768', marginBottom: '32px', fontSize: '14px' }}>
          Send an enquiry and we'll get back to you — or book directly online any time.
        </p>

        {submitted ? (
          <div className="go-sans" style={{ textAlign: 'center', padding: '40px 20px', background: themeConfig.secondaryColor, borderRadius: '16px' }}>
            <p style={{ fontSize: '17px', fontWeight: 500, margin: 0 }}>Thanks — we'll be in touch soon.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="go-sans" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <input
              required
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #E4D8CE', fontSize: '14px' }}
            />
            <input
              required
              placeholder="Phone or email"
              value={contact}
              onChange={e => setContact(e.target.value)}
              style={{ padding: '14px 16px', borderRadius: '10px', border: '1px solid #E4D8CE', fontSize: '14px' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '6px 0' }}>
              {SERVICE_TAGS.map(tag => (
                <span
                  key={tag}
                  className={`go-tag${selectedTags.includes(tag) ? ' selected' : ''}`}
                  onClick={() => toggleTag(tag)}
                  style={{ padding: '8px 14px', borderRadius: '999px', border: '1px solid #E4D8CE', fontSize: '13px' }}
                >
                  {tag}
                </span>
              ))}
            </div>
            <button
              type="submit"
              disabled={submitting}
              style={{ padding: '14px', borderRadius: '10px', border: 'none', background: themeConfig.primaryColor, color: '#fff', fontWeight: 600, fontSize: '15px', cursor: 'pointer' }}
            >
              {submitting ? 'Sending…' : 'Send enquiry'}
            </button>
          </form>
        )}
      </section>

      <footer className="go-sans" style={{ padding: '48px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center', background: themeConfig.secondaryColor }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <BookingButton />
          <POSLink />
          <StaffLoginButton />
        </div>
        {!loading && shop && <p style={{ fontSize: '13px', color: '#8A7768' }}>{shop.address} · {shop.phone}</p>}
      </footer>
    </div>
  )
}
