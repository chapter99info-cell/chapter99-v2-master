import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

const PLACEHOLDER_COUNT = 4

export default function GallerySlot() {
  const { shop, loading } = useShopContext()
  const images = [shop?.heroImageUrl, shop?.logoUrl].filter(Boolean) as string[]

  return (
    <section style={{ padding: '48px 24px', background: '#FAF7FF' }}>
      <h2
        style={{
          margin: '0 0 8px',
          textAlign: 'center',
          color: themeConfig.primaryColor,
          fontFamily: 'Georgia, serif',
        }}
      >
        {loading ? '…' : 'Gallery'}
      </h2>
      <p
        style={{
          margin: '0 0 24px',
          textAlign: 'center',
          color: themeConfig.secondaryColor,
          fontSize: '14px',
        }}
      >
        ✦ ✦ ✦
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
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
                  aspectRatio: '1',
                  objectFit: 'cover',
                  borderRadius: '4px',
                  border: `3px solid ${themeConfig.secondaryColor}`,
                }}
              />
            ))
          : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '1',
                  borderRadius: '4px',
                  background: `${themeConfig.primaryColor}18`,
                  border: `2px solid ${themeConfig.secondaryColor}66`,
                }}
              />
            ))}
      </div>
    </section>
  )
}
