import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function HeroSlot() {
  const { shop, loading, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Welcome')
  const subtitle =
    shop?.heroSubtitle?.trim() ||
    (isRestaurant ? 'Simple ordering, done well.' : 'Calm. Clean. Restored.')

  return (
    <section
      style={{
        padding: '80px 24px',
        textAlign: 'left',
        maxWidth: '720px',
        margin: '0 auto',
        background: themeConfig.secondaryColor,
        color: themeConfig.primaryColor,
      }}
    >
      <h1
        style={{
          margin: '0 0 12px',
          fontSize: '2rem',
          fontWeight: 400,
          letterSpacing: '-0.02em',
        }}
      >
        {name}
      </h1>
      <p style={{ margin: 0, fontSize: '16px', lineHeight: 1.6, opacity: 0.85 }}>
        {subtitle}
      </p>
    </section>
  )
}
