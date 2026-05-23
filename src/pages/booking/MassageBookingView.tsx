import BookingWizard from '../../components/booking/BookingWizard'
import { useShopContext } from '../../contexts/ShopContext'

export default function MassageBookingView() {
  const { shop, shopId } = useShopContext()

  if (!shopId) return null

  return (
    <div className="public-page public-book-wrap">
      <p className="public-eyebrow">Online booking</p>
      <h1 className="public-page-title">{shop?.name || 'Book your appointment'}</h1>
      <p className="public-page-lead">
        Choose your treatment, preferred time, and therapist. Confirmation by email — no account
        needed.
      </p>
      <BookingWizard shopId={shopId} variant="public" />
    </div>
  )
}
