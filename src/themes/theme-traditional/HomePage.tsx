import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import HeroSlot from './HeroSlot'
import GallerySlot from './GallerySlot'
import { themeConfig } from './theme.config'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      <HeroSlot />
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'center',
          padding: '24px',
          borderTop: `2px solid ${themeConfig.secondaryColor}`,
          borderBottom: `2px solid ${themeConfig.secondaryColor}`,
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
