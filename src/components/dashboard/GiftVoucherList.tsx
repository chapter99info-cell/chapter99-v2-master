import { useEffect, useState } from 'react'
import { fetchGiftVouchers, formatVoucherExpiry } from '../../lib/giftVoucherService'
import { formatAUD } from '../../lib/posCalc'
import type { GiftVoucher } from '../../types/giftVoucher'
import './GiftVoucherList.css'

interface GiftVoucherListProps {
  shopId: string
}

function statusLabel(status: GiftVoucher['status']): string {
  if (status === 'active') return 'Active'
  if (status === 'redeemed') return 'Redeemed'
  return 'Expired'
}

export default function GiftVoucherList({ shopId }: GiftVoucherListProps) {
  const [vouchers, setVouchers] = useState<GiftVoucher[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await fetchGiftVouchers(shopId)
        if (!cancelled) setVouchers(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load vouchers')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [shopId])

  return (
    <section className="voucher-list" aria-labelledby="voucher-list-heading">
      <div className="voucher-list-header">
        <h2 id="voucher-list-heading" className="voucher-list-title">
          Gift vouchers
        </h2>
        <span className="voucher-list-sub">{vouchers.length} total</span>
      </div>

      {error && <p className="voucher-list-error">{error}</p>}

      {loading && <p className="voucher-list-loading">Loading vouchers…</p>}

      {!loading && !error && vouchers.length === 0 && (
        <p className="voucher-list-empty">
          No gift vouchers sold yet. Sell from POS → Gift Voucher.
        </p>
      )}

      {!loading && vouchers.length > 0 && (
        <div className="voucher-table-wrap">
          <table className="voucher-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Original</th>
                <th>Balance</th>
                <th>Expires</th>
                <th>Status</th>
                <th>Buyer</th>
              </tr>
            </thead>
            <tbody>
              {vouchers.map(v => (
                <tr key={v.id} className={`voucher-row voucher-row--${v.status}`}>
                  <td className="voucher-code">{v.code}</td>
                  <td>{formatAUD(v.originalAmount)}</td>
                  <td>{formatAUD(v.remainingBalance)}</td>
                  <td>{formatVoucherExpiry(v.expiryDate)}</td>
                  <td>
                    <span className={`voucher-status voucher-status--${v.status}`}>
                      {statusLabel(v.status)}
                    </span>
                  </td>
                  <td className="voucher-buyer">
                    {v.buyerName ?? '—'}
                    {v.buyerEmail && (
                      <span className="voucher-buyer-email">{v.buyerEmail}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
