import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import HeroSlot from './HeroSlot'
import GallerySlot from './GallerySlot'
import { themeConfig } from './theme.config'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100%', background: themeConfig.background }}>
      <HeroSlot />
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
          padding: '28px 24px',
          background: themeConfig.surface,
          borderTop: `1px solid ${themeConfig.secondaryColor}44`,
          borderBottom: `1px solid ${themeConfig.secondaryColor}44`,
        }}
      >
        <BookingButton />
        <POSLink />
        <StaffLoginButton />
      </section>
      <GallerySlot />
    </div>
  )
}
