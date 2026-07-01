import { useShopContext } from '../../contexts/ShopContext'
import { themeConfig } from './theme.config'

export default function GallerySlot() {
  const { shop, loading } = useShopContext()
  const images = [shop?.heroImageUrl, shop?.logoUrl].filter(Boolean) as string[]

  return (
    <section
      style={{
        padding: '48px 24px',
        maxWidth: '720px',
        margin: '0 auto',
        borderTop: `1px solid ${themeConfig.primaryColor}33`,
      }}
    >
      <h2
        style={{
          margin: '0 0 24px',
          fontSize: '13px',
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: themeConfig.primaryColor,
        }}
      >
        {loading ? '…' : 'Photos'}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {images.length > 0
          ? images.map((src, i) => (
              <img
                key={src}
                src={src}
                alt={`Photo ${i + 1}`}
                loading="lazy"
                style={{ width: '100%', display: 'block' }}
              />
            ))
          : [0, 1].map((i) => (
              <div
                key={i}
                style={{
                  height: '180px',
                  background: `${themeConfig.primaryColor}11`,
                }}
              />
            ))}
      </div>
    </section>
  )
}
