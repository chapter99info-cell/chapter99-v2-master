import { Link } from 'react-router-dom'
import { useShopContext } from '../contexts/ShopContext'
import LegalDocument, { LegalSection } from '../components/legal/LegalDocument'
import './PublicSite.css'

const LAST_UPDATED = '23 May 2026'

export default function PrivacyPolicyPage() {
  const { shop, loading, error, withShopQuery } = useShopContext()
  const shopName = shop?.name ?? 'this business'
  const contactEmail = shop?.email?.trim() || shop?.notificationEmail?.trim()
  const abn = shop?.abn?.trim()

  if (loading) {
    return (
      <div className="public-page">
        <p className="public-page-lead">Loading privacy policy…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="public-page">
        <h1 className="public-page-title">Privacy Policy unavailable</h1>
        <p className="public-page-lead">{error}</p>
      </div>
    )
  }

  return (
    <LegalDocument title="Privacy Policy" shopName={shopName} lastUpdated={LAST_UPDATED}>
      <p className="legal-intro">
        {shopName} (&quot;we&quot;, &quot;us&quot;) respects your privacy. This Privacy Policy
        explains how we collect, use, and protect personal information in accordance with the{' '}
        <em>Privacy Act 1988</em> (Cth) and the Australian Privacy Principles (APPs).
        {abn && (
          <>
            {' '}
            Our Australian Business Number (ABN) is <strong>{abn}</strong>.
          </>
        )}
      </p>

      <LegalSection title="Data we collect">
        <p>We may collect the following types of personal information:</p>
        <ul>
          <li>Name, phone number, and email address when you book online or visit us</li>
          <li>Appointment details (service, date, time, therapist preferences)</li>
          <li>Payment-related information processed by our payment providers (we do not store full card numbers)</li>
          <li>Health or treatment notes you choose to share for remedial or wellness services</li>
          <li>Communications you send us (email, SMS, or phone)</li>
          <li>Technical data such as IP address and browser type when you use our website</li>
        </ul>
      </LegalSection>

      <LegalSection title="How we use it">
        <p>We use personal information to:</p>
        <ul>
          <li>Confirm and manage bookings, orders, and gift vouchers</li>
          <li>Send appointment reminders and service-related messages</li>
          <li>Process payments and issue receipts</li>
          <li>Improve our services and comply with legal obligations</li>
          <li>Respond to enquiries and support requests</li>
        </ul>
        <p>
          We only use your information for purposes you would reasonably expect, or where you have
          consented, unless otherwise required by law.
        </p>
      </LegalSection>

      <LegalSection title="Third parties">
        <p>
          We use trusted service providers who process data on our behalf, including:
        </p>
        <ul>
          <li>
            <strong>Supabase</strong> — secure database hosting for bookings and shop data
          </li>
          <li>
            <strong>Stripe</strong> — card and online payment processing
          </li>
          <li>
            <strong>Twilio</strong> — SMS notifications (where enabled)
          </li>
          <li>
            <strong>Resend</strong> — transactional email delivery
          </li>
        </ul>
        <p>
          These providers are contractually required to handle data appropriately. Some may store
          data outside Australia; where that occurs, we take reasonable steps to ensure APP
          compliance.
        </p>
      </LegalSection>

      <LegalSection title="Your rights">
        <p>Under Australian privacy law, you may:</p>
        <ul>
          <li>Request access to the personal information we hold about you</li>
          <li>Ask us to correct inaccurate or out-of-date information</li>
          <li>Request deletion where we are not legally required to retain records</li>
          <li>Complain to the Office of the Australian Information Commissioner (OAIC) if you believe we have breached the APPs</li>
        </ul>
        <p>
          To exercise these rights, contact us using the details below. We will respond within a
          reasonable time.
        </p>
      </LegalSection>

      <LegalSection title="Data security">
        <p>
          We protect your information using industry-standard measures, including encrypted
          connections (HTTPS), access controls, and Supabase Row Level Security (RLS) so each shop&apos;s
          data is isolated. Staff access is limited by role and PIN. No method of transmission over
          the internet is 100% secure; we encourage you to use strong passwords and protect your
          devices.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          For privacy questions or requests, contact <strong>{shopName}</strong>
          {contactEmail ? (
            <>
              {' '}
              at{' '}
              <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </>
          ) : (
            ' using the contact details on our website'
          )}
          .
        </p>
      </LegalSection>

      <p className="legal-back">
        <Link to={withShopQuery('/book')}>← Back to booking</Link>
      </p>
    </LegalDocument>
  )
}
