import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function HeroSlot() {
  const { shop, loading, businessType } = useShopContext()
  const isRestaurant = businessType === 'restaurant'
  const name = shop?.heroTitle?.trim() || shop?.name || (loading ? '…' : 'Welcome')
  const subtitle =
    shop?.heroSubtitle?.trim() ||
    (isRestaurant ? 'Authentic flavours, warm hospitality.' : 'Ancient healing traditions.')
  const heroImage = shop?.heroImageUrl?.trim()

  return (
    <section
      style={{
        padding: '72px 24px',
        textAlign: 'center',
        background: heroImage
          ? `linear-gradient(rgba(123, 94, 167, 0.65), rgba(123, 94, 167, 0.8)), url(${heroImage}) center/cover`
          : `linear-gradient(160deg, ${themeConfig.primaryColor}, #5a4580)`,
        color: '#FFFFFF',
        borderBottom: `4px solid ${themeConfig.secondaryColor}`,
      }}
    >
      <p style={{ margin: '0 0 8px', color: themeConfig.secondaryColor, fontSize: '14px' }}>
        ✦ {isRestaurant ? 'Thai Cuisine' : 'Thai Healing Arts'} ✦
      </p>
      <h1 style={{ margin: '0 0 16px', fontFamily: 'Georgia, serif', fontSize: '2.25rem' }}>
        {name}
      </h1>
      <p style={{ margin: 0, maxWidth: '520px', marginInline: 'auto' }}>{subtitle}</p>
    </section>
  )
}
