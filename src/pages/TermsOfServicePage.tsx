import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import LegalDocument, { LegalSection } from '../components/legal/LegalDocument'
import './PublicSite.css'

const LAST_UPDATED = '23 May 2026'

export default function TermsOfServicePage() {
  const { shop, loading, error, withShopQuery, businessType } = useShopContext()
  const shopName = shop?.name ?? 'this business'
  const isRestaurant = businessType === 'restaurant'

  if (loading) {
    return (
      <div className="public-page">
        <p className="public-page-lead">Loading terms of service…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-page">
        <h1 className="public-page-title">Terms of Service unavailable</h1>
        <p className="public-page-lead">{error}</p>
      </div>
    )
  }

  return (
    <LegalDocument title="Terms of Service" shopName={shopName} lastUpdated={LAST_UPDATED}>
      <p className="legal-intro">
        These Terms of Service (&quot;Terms&quot;) apply when you use the website and booking
        services of <strong>{shopName}</strong>. By making a booking or purchase, you agree to
        these Terms.
      </p>

      <LegalSection title="Booking & cancellation">
        <p>
          {isRestaurant
            ? 'Orders and table bookings are subject to availability. Please arrive on time for reserved tables.'
            : 'Appointments are subject to therapist and room availability. A booking is confirmed once you receive confirmation by email or SMS.'}
        </p>
        <p>
          <strong>Cancellation policy:</strong> Please provide at least <strong>24 hours</strong>{' '}
          notice to cancel or reschedule. Late cancellations or no-shows may incur a fee equal to
          the full service price, at our discretion, to cover lost appointment time.
        </p>
      </LegalSection>

      <LegalSection title="Payment & GST">
        <p>
          Prices are shown in Australian dollars (AUD). Unless stated otherwise, prices include
          Goods and Services Tax (GST) at 10% where applicable. Remedial massage and certain
          health services may be GST-free under Australian law.
        </p>
        <p>
          Card payments may attract a surcharge where displayed at checkout. PayID and cash
          options are offered where available.
        </p>
      </LegalSection>

      <LegalSection title="Health disclaimer">
        <p>
          {isRestaurant
            ? 'Menu information is provided in good faith. Please inform us of allergies or dietary requirements before ordering.'
            : 'Massage and bodywork are complementary wellness services, not a substitute for medical diagnosis or treatment. You must inform us of injuries, pregnancy, or health conditions before your session. We may refuse or modify treatment if we believe it is unsafe.'}
        </p>
      </LegalSection>

      <LegalSection title="Gift voucher policy">
        <p>
          Gift vouchers sold by {shopName} are valid for the period stated on the voucher and for at
          least <strong>3 years</strong> from the date of purchase, as required under Australian
          Consumer Law. Vouchers are not redeemable for cash unless required by law. Lost or stolen
          vouchers cannot be replaced unless we can verify the original purchase.
        </p>
      </LegalSection>

      <LegalSection title="Limitation of liability">
        <p>
          To the maximum extent permitted by Australian Consumer Law, our liability for any claim
          arising from our services is limited to re-supplying the service or refunding the amount
          paid for the relevant booking. We are not liable for indirect or consequential loss
          (including lost income) except where liability cannot be excluded by law.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These Terms are governed by the laws of the State of <strong>Victoria</strong> and the
          State of <strong>New South Wales</strong>, Australia, and the Commonwealth of Australia.
          You submit to the non-exclusive jurisdiction of courts in those states.
        </p>
      </LegalSection>

      <p className="legal-back">
        <Link to={withShopQuery('/book')}>← Back to booking</Link>
      </p>
    </LegalDocument>
  )
}
