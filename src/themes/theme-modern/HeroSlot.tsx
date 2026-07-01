import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function HeroSlot() {
  const { shop, loading, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Welcome')
  const subtitle =
    shop?.heroSubtitle?.trim() ||
    (isRestaurant ? 'Fresh. Fast. Delivered.' : 'Modern wellness, expertly delivered.')
  const heroImage = shop?.heroImageUrl?.trim()

  return (
    <section
      style={{
        padding: '96px 24px',
        textAlign: 'center',
        background: heroImage
          ? `linear-gradient(rgba(26, 26, 26, 0.7), rgba(26, 26, 26, 0.85)), url(${heroImage}) center/cover`
          : themeConfig.primaryColor,
        color: themeConfig.secondaryColor,
      }}
    >
      <h1
        style={{
          margin: '0 0 16px',
          fontSize: '3rem',
          fontWeight: 700,
          letterSpacing: '-0.03em',
        }}
      >
        {name}
      </h1>
      <p style={{ margin: 0, fontSize: '18px', opacity: 0.8, maxWidth: '480px', marginInline: 'auto' }}>
        {subtitle}
      </p>
      <p style={{ margin: '16px 0 0', fontSize: '12px', opacity: 0.5, textTransform: 'uppercase' }}>
        {isRestaurant ? 'Order · Pickup · Dine in' : 'Book · Relax · Restore'}
      </p>
    </section>
  )
}
