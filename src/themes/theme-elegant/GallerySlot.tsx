import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

const PLACEHOLDER_COUNT = 3

export default function GallerySlot() {
  const { shop, loading } = useShopContext()
  const images = [shop?.heroImageUrl, shop?.logoUrl].filter(Boolean) as string[]

  return (
    <section style={{ padding: '48px 24px', background: '#F8F5F0' }}>
      <h2
        style={{
          margin: '0 0 24px',
          textAlign: 'center',
          color: themeConfig.primaryColor,
          fontFamily: 'Georgia, serif',
        }}
      >
        {loading ? '…' : 'Our Space'}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {images.length > 0
          ? images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Gallery ${i + 1}`}
                loading="lazy"
                style={{
                  width: '100%',
                  aspectRatio: '4/3',
                  objectFit: 'cover',
                  borderRadius: '8px',
                  border: `2px solid ${themeConfig.secondaryColor}`,
                }}
              />
            ))
          : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '4/3',
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, ${themeConfig.primaryColor}22, ${themeConfig.secondaryColor}44)`,
                  border: `1px dashed ${themeConfig.secondaryColor}`,
                }}
              />
            ))}
      </div>
    </section>
  )
}
