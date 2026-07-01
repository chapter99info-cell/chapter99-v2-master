import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

const PLACEHOLDER_COUNT = 3

export default function GallerySlot() {
  const { shop, loading } = useShopContext()
  const images = [shop?.heroImageUrl, shop?.logoUrl].filter(Boolean) as string[]

  return (
    <section style={{ padding: '64px 24px', background: '#F4F4F4' }}>
      <h2
        style={{
          margin: '0 0 32px',
          textAlign: 'center',
          color: themeConfig.primaryColor,
          fontSize: '24px',
          fontWeight: 700,
        }}
      >
        {loading ? '…' : 'Visuals'}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '8px',
          maxWidth: '960px',
          margin: '0 auto',
        }}
      >
        {images.length > 0
          ? images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Visual ${i + 1}`}
                loading="lazy"
                style={{
                  width: '100%',
                  aspectRatio: '16/10',
                  objectFit: 'cover',
                  filter: 'grayscale(20%)',
                }}
              />
            ))
          : Array.from({ length: PLACEHOLDER_COUNT }, (_, i) => (
              <div
                key={i}
                style={{
                  aspectRatio: '16/10',
                  background: themeConfig.primaryColor,
                  opacity: 0.08 + i * 0.04,
                }}
              />
            ))}
      </div>
    </section>
  )
}
