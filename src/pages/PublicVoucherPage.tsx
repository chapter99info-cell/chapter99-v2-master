import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { VOUCHER_PRESET_AMOUNTS } from '../types/giftVoucher'
import { useShopContext } from '../contexts/ShopContext'
import { formatAUD } from '../lib/posCalc'
import { parseApiJson } from '../lib/parseApiResponse'
import './PublicVoucherPage.css'

export default function PublicVoucherPage() {
  const { shop, shopId, shopSlug } = useShopContext()
  const [searchParams] = useSearchParams()
  const [amount, setAmount] = useState<number | 'custom'>(100)
  const [customAmount, setCustomAmount] = useState('')
  const [recipientName, setRecipientName] = useState('')
  const [recipientEmail, setRecipientEmail] = useState('')
  const [buyerName, setBuyerName] = useState('')
  const [buyerEmail, setBuyerEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [successCode, setSuccessCode] = useState<string | null>(null)

  const resolvedAmount =
    amount === 'custom' ? parseFloat(customAmount) || 0 : amount

  useEffect(() => {
    const sessionId = searchParams.get('session_id')
    const success = searchParams.get('success')
    if (success === '1' && sessionId) {
      setLoading(true)
      fetch('/api/voucher-complete-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
        .then(async r => {
          const data = await parseApiJson<{
            voucherCode?: string
            error?: string
          }>(r)
          if (!r.ok) throw new Error(data.error || 'Could not confirm payment')
          if (data.voucherCode) setSuccessCode(data.voucherCode)
          else if (data.error) setError(data.error)
        })
        .catch(e =>
          setError(e instanceof Error ? e.message : 'Could not confirm payment')
        )
        .finally(() => setLoading(false))
    }
    if (searchParams.get('cancelled') === '1') {
      setError('Payment was cancelled')
    }
  }, [searchParams])

  const handleCheckout = async () => {
    setError('')
    if (!shopId) {
      setError('Shop not loaded — use the booking link from the store website.')
      return
    }
    if (resolvedAmount < 5) {
      setError('Minimum voucher amount is $5')
      return
    }
    if (!recipientName.trim() || !recipientEmail.trim() || !buyerEmail.trim()) {
      setError('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/stripe-create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          amount: resolvedAmount,
          recipientName,
          recipientEmail,
          buyerName: buyerName.trim() || recipientName,
          buyerEmail,
          shopId,
          shopSlug: shopSlug ?? undefined,
        }),
      })
      const data = await parseApiJson<{ url?: string; error?: string }>(res)
      if (!res.ok) throw new Error(data.error || 'Checkout failed')
      if (data.url) window.location.href = data.url
      else throw new Error('No checkout URL returned')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Checkout failed')
      setLoading(false)
    }
  }

  if (successCode) {
    return (
      <div className="voucher-public-card voucher-public-success">
        <h1>Gift voucher sent!</h1>
        <p className="voucher-public-code">{successCode}</p>
        <p>We emailed the voucher to {recipientEmail || 'your recipient'}.</p>
        <a href="/voucher" className="voucher-public-btn">
          Buy another
        </a>
      </div>
    )
  }

  return (
    <div className="public-page">
      <h1 className="public-page-title">Gift vouchers</h1>
      <p className="public-page-lead">{shop?.name ?? 'Mira Thai Massage'}</p>

      <div className="voucher-public-card">
        <h2>Select amount</h2>
        <div className="voucher-amount-grid">
          {VOUCHER_PRESET_AMOUNTS.filter(a => [50, 100, 150].includes(a)).map(a => (
            <button
              key={a}
              type="button"
              className={`voucher-amount-btn${amount === a ? ' selected' : ''}`}
              onClick={() => setAmount(a)}
            >
              {formatAUD(a)}
            </button>
          ))}
          <button
            type="button"
            className={`voucher-amount-btn${amount === 'custom' ? ' selected' : ''}`}
            onClick={() => setAmount('custom')}
          >
            Custom
          </button>
        </div>
        {amount === 'custom' && (
          <input
            className="voucher-public-input"
            type="number"
            min={5}
            step={1}
            placeholder="Amount (AUD)"
            value={customAmount}
            onChange={e => setCustomAmount(e.target.value)}
          />
        )}

        <h2>Recipient</h2>
        <input
          className="voucher-public-input"
          placeholder="Recipient name *"
          value={recipientName}
          onChange={e => setRecipientName(e.target.value)}
        />
        <input
          className="voucher-public-input"
          type="email"
          placeholder="Recipient email *"
          value={recipientEmail}
          onChange={e => setRecipientEmail(e.target.value)}
        />

        <h2>Your details</h2>
        <input
          className="voucher-public-input"
          placeholder="Your name"
          value={buyerName}
          onChange={e => setBuyerName(e.target.value)}
        />
        <input
          className="voucher-public-input"
          type="email"
          placeholder="Your email *"
          value={buyerEmail}
          onChange={e => setBuyerEmail(e.target.value)}
        />

        {error && <p className="voucher-public-error">{error}</p>}

        <button
          type="button"
          className="voucher-public-btn primary"
          disabled={loading}
          onClick={handleCheckout}
        >
          {loading ? 'Redirecting…' : `Pay ${formatAUD(resolvedAmount)} with card`}
        </button>

        <p className="voucher-public-note">
          Valid for 12 months. Recipient receives the code by email after payment.
        </p>
      </div>
    </div>
  )
}
