import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { normalizeGoogleReviewUrl } from '../lib/reviewUrl'

type Step = 'rating' | 'complaint' | 'thanks' | 'redirect'

export default function ReviewPage() {
  const { bookingId } = useParams<{ bookingId: string }>()
  const [shopName, setShopName] = useState('Our spa')
  const [loading, setLoading] = useState(true)
  const [step, setStep] = useState<Step>('rating')
  const [rating, setRating] = useState(0)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [googleUrl, setGoogleUrl] = useState('')

  useEffect(() => {
    if (!bookingId) {
      setLoading(false)
      return
    }
    void supabase
      .from('bookings')
      .select('id, shops ( name )')
      .eq('id', bookingId)
      .maybeSingle()
      .then(({ data }) => {
        const shop = data?.shops as { name?: string } | null
        if (shop?.name) setShopName(shop.name)
        setLoading(false)
      })
  }, [bookingId])

  const submitRating = async (selectedRating: number) => {
    if (!bookingId || submitting) return
    setRating(selectedRating)
    setSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/review/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId,
          rating: selectedRating,
          message: selectedRating <= 3 ? message : undefined,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        route?: string
        googleReviewUrl?: string | null
        error?: string
      }
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'Could not submit review')
        return
      }
      if (data.route === 'google' && data.googleReviewUrl) {
        const url = normalizeGoogleReviewUrl(data.googleReviewUrl)
        setGoogleUrl(url)
        setStep('redirect')
        window.setTimeout(() => {
          window.location.href = url
        }, 2000)
      } else if (data.route === 'complaint') {
        setStep('thanks')
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStarClick = (stars: number) => {
    if (stars <= 3) {
      setRating(stars)
      setStep('complaint')
    } else {
      void submitRating(stars)
    }
  }

  if (loading) {
    return (
      <div className="review-page">
        <p>Loading…</p>
      </div>
    )
  }

  if (!bookingId) {
    return (
      <div className="review-page">
        <h1>Invalid review link</h1>
      </div>
    )
  }

  return (
    <div className="review-page">
      <div className="review-card">
        <h1>How was your massage?</h1>
        <p className="review-sub">รีวิวการนวดของคุณ — {shopName}</p>

        {error && <p className="review-error">{error}</p>}

        {step === 'rating' && (
          <>
            <p>Tap a star rating / ให้คะแนน 1–5 ดาว</p>
            <div className="review-stars" role="group" aria-label="Star rating">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  className="review-star-btn"
                  disabled={submitting}
                  onClick={() => handleStarClick(n)}
                  aria-label={`${n} stars`}
                >
                  ★
                </button>
              ))}
            </div>
          </>
        )}

        {step === 'complaint' && (
          <>
            <p>We&apos;re sorry to hear that. Tell us what happened — we want to make it right.</p>
            <textarea
              className="review-textarea"
              rows={5}
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Your feedback (optional)"
            />
            <div className="review-stars selected" aria-hidden>
              {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
            </div>
            <button
              type="button"
              className="review-submit-btn"
              disabled={submitting}
              onClick={() => void submitRating(rating)}
            >
              {submitting ? 'Sending…' : 'Submit feedback'}
            </button>
          </>
        )}

        {step === 'redirect' && (
          <>
            <p>Thank you! Redirecting you to Google Reviews…</p>
            {googleUrl && (
              <a href={googleUrl} className="review-submit-btn">
                Leave a Google review
              </a>
            )}
          </>
        )}

        {step === 'thanks' && (
          <>
            <h2>Thank you</h2>
            <p>
              Your feedback has been sent to the owner privately. We&apos;ll be in touch soon.
            </p>
            <p className="review-sub">ขอบคุณที่แจ้งให้เราทราบ — เจ้าของร้านจะติดต่อกลับ</p>
          </>
        )}
      </div>
    </div>
  )
}
