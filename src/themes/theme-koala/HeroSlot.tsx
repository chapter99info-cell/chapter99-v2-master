import { Link } from 'react-router-dom'
import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function HeroSlot() {
  const { shop, loading, businessType, withShopQuery } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Koala Wellness & Spa')
  const subtitle =
    shop?.heroSubtitle?.trim() ||
    (isRestaurant
      ? 'Nourishing food, calm atmosphere.'
      : 'Personalised wellness with Than — Kirkstall, VIC.')
  const heroImage = shop?.heroImageUrl?.trim()

  return (
    <section
      className="koala-hero"
      style={{
        padding: '72px 24px 64px',
        textAlign: 'center',
        background: heroImage
          ? `linear-gradient(rgba(47, 79, 58, 0.58), rgba(47, 79, 58, 0.75)), url(${heroImage}) center/cover`
          : `linear-gradient(160deg, ${themeConfig.background} 0%, ${themeConfig.mist} 55%, ${themeConfig.secondaryColor}33 100%)`,
        color: heroImage ? '#FFFFFF' : themeConfig.primaryColor,
        borderBottom: `3px solid ${themeConfig.secondaryColor}`,
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          color: heroImage ? themeConfig.accentColor : themeConfig.secondaryColor,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        Wellness &amp; Remedial Care
      </p>
      <h1
        style={{
          margin: '0 0 16px',
          fontFamily: '"DM Serif Display", Georgia, serif',
          fontSize: 'clamp(2rem, 5.5vw, 2.75rem)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
        }}
      >
        {name}
      </h1>
      <p
        style={{
          margin: '0 auto 28px',
          maxWidth: '520px',
          fontSize: '17px',
          lineHeight: 1.55,
          opacity: heroImage ? 0.95 : 0.9,
        }}
      >
        {subtitle}
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
        <Link
          to={withShopQuery('/book')}
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            borderRadius: '999px',
            fontWeight: 600,
            fontSize: '15px',
            textDecoration: 'none',
            background: themeConfig.primaryColor,
            color: '#FFFFFF',
            border: `2px solid ${themeConfig.primaryColor}`,
          }}
        >
          Book with Than
        </Link>
        <Link
          to={withShopQuery('/services')}
          style={{
            display: 'inline-block',
            padding: '14px 28px',
            borderRadius: '999px',
            fontWeight: 600,
            fontSize: '15px',
            textDecoration: 'none',
            background: 'transparent',
            color: heroImage ? '#FFFFFF' : themeConfig.primaryColor,
            border: `2px solid ${heroImage ? 'rgba(255,255,255,0.65)' : themeConfig.secondaryColor}`,
          }}
        >
          View services
        </Link>
      </div>
    </section>
  )
}
