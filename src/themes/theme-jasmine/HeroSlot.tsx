import { Link } from 'react-router-dom'
import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function HeroSlot() {
  const { shop, loading, businessType, withShopQuery } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Jasmine Thai Spa')
  const subtitle =
    shop?.heroSubtitle?.trim() ||
    (isRestaurant
      ? 'Authentic Thai flavours in an elegant setting.'
      : 'Luxury traditional Thai healing — restore body and spirit.')
  const heroImage = shop?.heroImageUrl?.trim()

  return (
    <section
      className="jasmine-hero"
      style={{
        padding: '80px 24px 72px',
        textAlign: 'center',
        background: heroImage
          ? `linear-gradient(rgba(44, 36, 22, 0.55), rgba(44, 36, 22, 0.72)), url(${heroImage}) center/cover`
          : `linear-gradient(165deg, ${themeConfig.background} 0%, #F8F0DC 45%, ${themeConfig.secondaryColor}22 100%)`,
        color: heroImage ? '#FFFFFF' : themeConfig.primaryColor,
        borderBottom: `3px solid ${themeConfig.secondaryColor}`,
      }}
    >
      <p
        style={{
          margin: '0 0 12px',
          color: heroImage ? themeConfig.accentColor : themeConfig.secondaryColor,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        ✦ {isRestaurant ? 'Thai Cuisine' : 'Traditional Thai Massage'} ✦
      </p>
      <h1
        style={{
          margin: '0 0 16px',
          fontFamily: '"Playfair Display", Georgia, serif',
          fontSize: 'clamp(2.25rem, 6vw, 3rem)',
          fontWeight: 700,
          letterSpacing: '-0.02em',
        }}
      >
        {name}
      </h1>
      <p
        style={{
          margin: '0 auto 28px',
          maxWidth: '540px',
          fontSize: '17px',
          lineHeight: 1.55,
          opacity: heroImage ? 0.95 : 0.88,
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
            background: themeConfig.secondaryColor,
            color: '#1F1A10',
            border: `2px solid ${themeConfig.secondaryColor}`,
          }}
        >
          {isRestaurant ? 'Order now' : 'Book now / จองคิว'}
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
            border: `2px solid ${heroImage ? 'rgba(255,255,255,0.7)' : themeConfig.secondaryColor}`,
          }}
        >
          View services
        </Link>
      </div>
    </section>
  )
}
