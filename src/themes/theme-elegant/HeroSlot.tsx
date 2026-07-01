import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function HeroSlot() {
  const { shop, loading, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Welcome')
  const subtitle =
    shop?.heroSubtitle?.trim() ||
    (isRestaurant
      ? 'Order online for pickup or delivery.'
      : 'Relax, restore, and recharge.')
  const heroImage = shop?.heroImageUrl?.trim()

  return (
    <section
      style={{
        padding: '64px 24px',
        textAlign: 'center',
        background: heroImage
          ? `linear-gradient(rgba(45, 80, 22, 0.6), rgba(45, 80, 22, 0.75)), url(${heroImage}) center/cover`
          : themeConfig.primaryColor,
        color: '#FFFFFF',
      }}
    >
      <p
        style={{
          margin: '0 0 8px',
          color: themeConfig.secondaryColor,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontSize: '13px',
        }}
      >
        {isRestaurant ? 'Dine with us' : 'Traditional Thai Massage'}
      </p>
      <h1 style={{ margin: '0 0 16px', fontFamily: 'Georgia, serif', fontSize: '2.5rem' }}>
        {name}
      </h1>
      <p style={{ margin: 0, maxWidth: '560px', marginInline: 'auto', opacity: 0.95 }}>
        {subtitle}
      </p>
    </section>
  )
}
