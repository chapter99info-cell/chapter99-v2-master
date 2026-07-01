import BookingButton from '../../components/core/BookingButton'
import POSLink from '../../components/core/POSLink'
import StaffLoginButton from '../../components/core/StaffLoginButton'
import HeroSlot from './HeroSlot'
import GallerySlot from './GallerySlot'

export default function HomePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFFFFF' }}>
      <HeroSlot />
      <section
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '24px',
          maxWidth: '720px',
          margin: '0 auto',
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
