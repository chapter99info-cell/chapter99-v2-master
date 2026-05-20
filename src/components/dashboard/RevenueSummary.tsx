import { useEffect, useState } from 'react'
import { formatAUD } from '../../lib/posCalc'
import { fetchRevenueStats, todaySydneyKey, type RevenueStats } from '../../lib/revenueStats'
import './RevenueSummary.css'

interface RevenueSummaryProps {
  shopId: string
}

function SkeletonCard({ wide }: { wide?: boolean }) {
  return (
    <div
      className={`revenue-card revenue-card--skeleton${wide ? ' revenue-card--breakdown' : ''}`}
    >
      <div className="revenue-card-label">&nbsp;</div>
      {!wide && <div className="revenue-card-value">&nbsp;</div>}
      {wide && (
        <div className="revenue-breakdown-rows">
          {[0, 1, 2].map(i => (
            <div key={i} className="revenue-skel-line" />
          ))}
        </div>
      )}
    </div>
  )
}

export default function RevenueSummary({ shopId }: RevenueSummaryProps) {
  const [stats, setStats] = useState<RevenueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(isRefresh = false) {
      if (!isRefresh) setLoading(true)
      setError(null)
      try {
        const data = await fetchRevenueStats(shopId)
        if (!cancelled) setStats(data)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Could not load revenue data')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    const interval = setInterval(() => load(true), 60_000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [shopId])

  const dateLabel = todaySydneyKey()

  return (
    <section className="revenue-summary" aria-labelledby="revenue-summary-heading">
      <div className="revenue-summary-header">
        <h2 id="revenue-summary-heading" className="revenue-summary-title">
          Revenue summary
        </h2>
        <span className="revenue-summary-sub">Today · {dateLabel}</span>
      </div>

      {error && <p className="revenue-summary-error">{error}</p>}

      {loading && !stats && (
        <div className="revenue-grid" aria-busy="true" aria-label="Loading revenue summary">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
          <SkeletonCard wide />
        </div>
      )}

      {stats && (
        <div className="revenue-grid">
          <article className="revenue-card">
            <p className="revenue-card-label">Today&apos;s revenue</p>
            <p className="revenue-card-value">{formatAUD(stats.todayRevenue)}</p>
          </article>
          <article className="revenue-card">
            <p className="revenue-card-label">This month&apos;s revenue</p>
            <p className="revenue-card-value">{formatAUD(stats.monthRevenue)}</p>
          </article>
          <article className="revenue-card">
            <p className="revenue-card-label">This year&apos;s revenue</p>
            <p className="revenue-card-value">{formatAUD(stats.yearRevenue)}</p>
          </article>
          <article className="revenue-card">
            <p className="revenue-card-label">Total bookings today</p>
            <p className="revenue-card-value revenue-card-value--count">
              {stats.bookingsToday}
            </p>
          </article>
          <article className="revenue-card revenue-card--breakdown">
            <p className="revenue-card-label">Payment breakdown (today)</p>
            <div className="revenue-breakdown-rows">
              <div className="revenue-breakdown-item">
                <span className="revenue-breakdown-method">Cash</span>
                <span className="revenue-breakdown-amount">
                  {formatAUD(stats.paymentBreakdown.cash)}
                </span>
              </div>
              <div className="revenue-breakdown-item">
                <span className="revenue-breakdown-method">Card</span>
                <span className="revenue-breakdown-amount">
                  {formatAUD(stats.paymentBreakdown.card)}
                </span>
              </div>
              <div className="revenue-breakdown-item">
                <span className="revenue-breakdown-method">HICAPS</span>
                <span className="revenue-breakdown-amount">
                  {formatAUD(stats.paymentBreakdown.hicaps)}
                </span>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  )
}
