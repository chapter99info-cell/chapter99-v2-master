import PublicBookingWizard from '../../components/booking/PublicBookingWizard'
import { AccessibleModeToggle } from '../../components/booking/AccessibleBookingMode'
import { useShopContext } from '../../contexts/ShopContext'
import { resolvePrivacyPolicyHref, resolveTermsHref } from '../../lib/legalUrls'

export default function MassageBookingView() {
  const { shop, shopId, shopSlug, withShopQuery } = useShopContext()

  if (!shopId || !shop || !shopSlug) return null

  const privacyHref = resolvePrivacyPolicyHref(shop, withShopQuery)
  const termsHref = resolveTermsHref(shop, withShopQuery)

  return (
    <div className="public-page public-book-wrap">
      <AccessibleModeToggle shopPhone={shop.phone} />
      <p className="public-eyebrow">Online booking</p>
      <h1 className="public-page-title">{shop.name || 'Book your appointment'}</h1>
      <p className="public-page-lead">
        Book in four easy steps. Confirmation by email and SMS — no account needed.
      </p>
      <PublicBookingWizard
        shopId={shopId}
        shopSlug={shopSlug}
        shop={shop}
        privacyHref={privacyHref}
        termsHref={termsHref}
      />
    </div>
  )
}
