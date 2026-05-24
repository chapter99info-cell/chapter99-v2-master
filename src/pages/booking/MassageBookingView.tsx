import BookingWizard from '../../components/booking/BookingWizard'
import { useShopContext } from '../../contexts/ShopContext'
import { resolvePrivacyPolicyHref, resolveTermsHref } from '../../lib/legalUrls'

export default function MassageBookingView() {
  const { shop, shopId, withShopQuery } = useShopContext()

  if (!shopId) return null

  const privacyHref = resolvePrivacyPolicyHref(shop, withShopQuery)
  const termsHref = resolveTermsHref(shop, withShopQuery)

  return (
    <div className="public-page public-book-wrap">
      <p className="public-eyebrow">Online booking</p>
      <h1 className="public-page-title">{shop?.name || 'Book your appointment'}</h1>
      <p className="public-page-lead">
        Choose your treatment, preferred time, and therapist. Confirmation by email — no account
        needed.
      </p>
      <BookingWizard
        shopId={shopId}
        variant="public"
        privacyHref={privacyHref}
        termsHref={termsHref}
      />
    </div>
  )
}
