import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import LegalDocument, { LegalSection } from '../components/legal/LegalDocument'
import './PublicSite.css'

const LAST_UPDATED = '23 May 2026'

export default function TermsOfServicePage() {
  const { shop, loading, error, withShopQuery, businessType } = useShopContext()
  const shopName = shop?.name ?? 'this business'
  const contactEmail = shop?.email?.trim() || shop?.notificationEmail?.trim()
  const abn = shop?.abn?.trim()
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
        These Terms of Service (&quot;Terms&quot;) apply when you use the website, booking, and
        payment services of <strong>{shopName}</strong>
        {abn ? <> (ABN {abn})</> : null}. By making a booking or purchase, you agree to these
        Terms.
        {contactEmail && (
          <>
            {' '}
            Questions: <a href={`mailto:${contactEmail}`}>{contactEmail}</a>.
          </>
        )}
      </p>

      <nav className="legal-toc" aria-label="Terms sections">
        <p className="legal-toc-title">Contents</p>
        <ul>
          <li>
            <a href="#booking">Booking &amp; cancellation</a>
          </li>
          <li>
            <a href="#payment">Payment &amp; GST</a>
          </li>
          <li>
            <a href="#health">Health disclaimer</a>
          </li>
          <li>
            <a href="#vouchers">Gift vouchers (3 year expiry)</a>
          </li>
          <li>
            <a href="#liability">Limitation of liability</a>
          </li>
          <li>
            <a href="#law">Governing law</a>
          </li>
        </ul>
      </nav>

      <LegalSection id="booking" title="Booking & cancellation">
        <p>
          {isRestaurant
            ? 'Orders and table bookings are subject to availability. Please arrive on time for reserved tables.'
            : 'Appointments are subject to therapist and room availability. A booking is confirmed once you receive confirmation by email or SMS.'}
        </p>
        <p>
          <strong>24-hour cancellation policy:</strong> Please provide at least{' '}
          <strong>24 hours</strong> notice to cancel or reschedule. Late cancellations or no-shows
          may incur a fee equal to the full service price, at our discretion, to cover lost
          appointment time.
        </p>
      </LegalSection>

      <LegalSection id="payment" title="Payment & GST">
        <p>
          Prices are shown in Australian dollars (AUD). Unless stated otherwise, advertised prices
          include Goods and Services Tax (GST) at <strong>10%</strong> where applicable under
          Australian law. Remedial massage and certain health services may be GST-free.
        </p>
        <p>
          Card payments may attract a surcharge where displayed at checkout. PayID and cash options
          are offered where available. Receipts are issued for completed transactions.
        </p>
      </LegalSection>

      <LegalSection id="health" title="Health disclaimer">
        {isRestaurant ? (
          <>
            <p>
              Menu descriptions and allergen information are provided in good faith but may change.
              You are responsible for informing us of allergies, intolerances, or dietary
              requirements before ordering.
            </p>
            <p>
              {shopName} is not liable for adverse reactions where we were not informed of relevant
              health or dietary needs.
            </p>
          </>
        ) : (
          <>
            <p>
              Massage, bodywork, and spa treatments offered by {shopName} are{' '}
              <strong>complementary wellness services</strong>. They are not a substitute for
              medical diagnosis, treatment, or advice from a qualified health practitioner.
            </p>
            <ul>
              <li>
                You must disclose injuries, medical conditions, pregnancy, medications, or recent
                surgery before your session.
              </li>
              <li>
                We may refuse, shorten, or modify treatment if we reasonably believe it is unsafe.
              </li>
              <li>
                You accept that minor soreness after treatment can occur and is not necessarily a
                sign of injury.
              </li>
            </ul>
            <p>
              If you experience severe or persistent pain, seek medical attention promptly and
              inform us as soon as practical.
            </p>
          </>
        )}
      </LegalSection>

      <LegalSection id="vouchers" title="Gift vouchers (3 year expiry)">
        <p>
          Gift vouchers and gift cards sold by {shopName} are subject to the following conditions:
        </p>
        <ul>
          <li>
            Vouchers are valid for the period printed on the voucher and for a{' '}
            <strong>minimum of 3 years</strong> from the date of purchase, as required by the{' '}
            <em>Australian Consumer Law</em> (ACL).
          </li>
          <li>
            Vouchers may be used toward eligible services or products as stated on the voucher.
          </li>
          <li>
            Vouchers are <strong>not redeemable for cash</strong> except where required by law.
          </li>
          <li>
            Lost, stolen, or damaged vouchers cannot be reissued unless we can verify the original
            purchase record.
          </li>
          <li>
            Vouchers cannot be resold for more than face value where prohibited by law.
          </li>
        </ul>
        <p>
          After expiry, we will honour any remaining entitlement required under the ACL. Contact us
          before the expiry date to arrange redemption where possible.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Limitation of liability">
        <p>
          Nothing in these Terms excludes, restricts, or modifies any guarantee, right, or remedy
          you may have under the <em>Australian Consumer Law</em> or other applicable legislation
          that cannot lawfully be excluded.
        </p>
        <p>
          To the maximum extent permitted by law, {shopName}&apos;s liability for any claim arising
          from our services is limited, at our option, to:
        </p>
        <ul>
          <li>re-supplying the service; or</li>
          <li>refunding the amount you paid for the relevant booking or voucher.</li>
        </ul>
        <p>
          We are not liable for indirect or consequential loss (including loss of income, profit, or
          opportunity) except where liability cannot be excluded by law.
        </p>
      </LegalSection>

      <LegalSection id="law" title="Governing law">
        <p>
          These Terms are governed by the laws of the State of <strong>Victoria</strong>, the State
          of <strong>New South Wales</strong>, and the Commonwealth of Australia.
        </p>
        <p>
          You submit to the non-exclusive jurisdiction of the courts of Victoria and New South
          Wales for any dispute arising from these Terms or your use of our services.
        </p>
        <p>
          If a provision of these Terms is held invalid, the remaining provisions continue in full
          force.
        </p>
      </LegalSection>

      <p className="legal-back">
        <Link to={withShopQuery('/book')}>← Back to booking</Link>
      </p>
    </LegalDocument>
  )
}
