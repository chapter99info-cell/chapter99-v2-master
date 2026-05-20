import { QRCodeSVG } from 'qrcode.react'

interface GoogleReviewQRProps {
  url: string
}

export default function GoogleReviewQR({ url }: GoogleReviewQRProps) {
  const reviewUrl = url.trim()
  if (!reviewUrl) return null

  return (
    <section className="google-review-section" aria-label="Google review">
      <h3 className="google-review-heading">Leave us a Google Review</h3>
      <div className="google-review-qr-wrap">
        <QRCodeSVG
          value={reviewUrl}
          size={148}
          level="M"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#085041"
        />
      </div>
      <p className="google-review-caption">Scan to review us on Google</p>
    </section>
  )
}
