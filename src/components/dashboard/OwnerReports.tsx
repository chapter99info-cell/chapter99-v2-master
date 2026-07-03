import { useEffect, useState, lazy, Suspense } from 'react'
import { formatAUD } from '../../lib/posCalc'
import {
  type ReportPeriod,
  fetchTherapistPerformance,
  fetchCommissionReport,
  fetchTransactionsForExport,
  exportTransactionsCsv,
  exportCommissionCsv,
  getMonthBounds,
  getExportRangeBounds,
  fetchReportsDashboard,
} from '../../lib/reportService'
import ReportsDashboard from './ReportsDashboard'
import { useFeatureTier, useShopFeatureContext } from '../shared/FeatureGate'
import { hasFeatureKey } from '../../lib/shopFeatureAccess'
import { buildWhatsAppUpgradeUrl } from '../../lib/featureGate'
import './OwnerReports.css'

const VisualAnalytics = lazy(() => import('./VisualAnalytics'))

interface OwnerReportsProps {
  shopId: string
}

export default function OwnerReports({ shopId }: OwnerReportsProps) {
  const featureTier = useFeatureTier()
  const featureContext = useShopFeatureContext()
  const hasCharts =
    hasFeatureKey(featureContext, 'advanced_reports') && featureTier === 'business'
  const [period, setPeriod] = useState<ReportPeriod>('today')
  const [numbersOnly, setNumbersOnly] = useState<{
    revenue: number
    commission: number
    profit: number
  } | null>(null)
  const [performance, setPerformance] = useState<Awaited<ReturnType<typeof fetchTherapistPerformance>>>([])
  const [perfLoading, setPerfLoading] = useState(true)
  const [perfError, setPerfError] = useState('')

  const [exportStart, setExportStart] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [exportEnd, setExportEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState('')

  const [commissionMonth, setCommissionMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [commission, setCommission] = useState<Awaited<ReturnType<typeof fetchCommissionReport>>>([])
  const [commissionLoading, setCommissionLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setPerfLoading(true)
    setPerfError('')
    fetchTherapistPerformance(shopId, period)
      .then(data => {
        if (!cancelled) setPerformance(data)
      })
      .catch(e => {
        if (!cancelled) setPerfError(e instanceof Error ? e.message : 'Failed to load')
      })
      .finally(() => {
        if (!cancelled) setPerfLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shopId, period])

  useEffect(() => {
    let cancelled = false
    setCommissionLoading(true)
    fetchCommissionReport(shopId, commissionMonth)
      .then(data => {
        if (!cancelled) setCommission(data)
      })
      .catch(() => {
        if (!cancelled) setCommission([])
      })
      .finally(() => {
        if (!cancelled) setCommissionLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shopId, commissionMonth])

  useEffect(() => {
    if (hasCharts) return
    let cancelled = false
    fetchReportsDashboard(shopId, period)
      .then(data => {
        if (!cancelled) {
          setNumbersOnly({
            revenue: data.metrics.revenue,
            commission: data.metrics.commission,
            profit: data.metrics.profit,
          })
        }
      })
      .catch(() => {
        if (!cancelled) setNumbersOnly(null)
      })
    return () => {
      cancelled = true
    }
  }, [shopId, period, hasCharts])

  const handleRevenueExport = async () => {
    setExportLoading(true)
    try {
      const { start, end } = getExportRangeBounds(exportStart, exportEnd)
      const rows = await fetchTransactionsForExport(shopId, start, end)
      if (rows.length === 0) {
        setExportError('No paid transactions in that date range.')
        return
      }
      setExportError('')
      exportTransactionsCsv(rows, `${exportStart}_to_${exportEnd}`)
    } catch (e) {
      setExportError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExportLoading(false)
    }
  }

  const handleMonthExport = async () => {
    setExportLoading(true)
    try {
      const { start, end } = getMonthBounds(commissionMonth)
      const rows = await fetchTransactionsForExport(shopId, start, end)
      exportTransactionsCsv(rows, commissionMonth)
    } finally {
      setExportLoading(false)
    }
  }

  const periodLabel =
    period === 'today' ? 'Today' : period === 'week' ? 'This Week' : 'This Month'

  return (
    <div className="owner-reports">
      {hasCharts ? (
        <>
          <ReportsDashboard shopId={shopId} period={period} onPeriodChange={setPeriod} />
          <Suspense fallback={<p className="reports-muted">Loading charts…</p>}>
            <VisualAnalytics shopId={shopId} />
          </Suspense>
        </>
      ) : (
        <>
          <header className="rd-topbar">
            <h2 className="rd-title">รายงานตัวเลข</h2>
            <div className="rd-period-tabs" role="tablist">
              {(['today', 'week', 'month'] as ReportPeriod[]).map(p => (
                <button
                  key={p}
                  type="button"
                  className={`rd-period-btn${period === p ? ' active' : ''}`}
                  onClick={() => setPeriod(p)}
                >
                  {p === 'today' ? 'วันนี้' : p === 'week' ? 'สัปดาห์' : 'เดือน'}
                </button>
              ))}
            </div>
          </header>
          {numbersOnly && (
            <div className="rd-metrics">
              <div className="rd-metric-card">
                <span className="rd-metric-label">รายรับ</span>
                <span className="rd-metric-value">{formatAUD(numbersOnly.revenue)}</span>
              </div>
              <div className="rd-metric-card">
                <span className="rd-metric-label">รายจ่าย</span>
                <span className="rd-metric-value expense">{formatAUD(numbersOnly.commission)}</span>
              </div>
              <div className="rd-metric-card">
                <span className="rd-metric-label">กำไรสุทธิ</span>
                <span className="rd-metric-value profit">{formatAUD(numbersOnly.profit)}</span>
              </div>
            </div>
          )}
          <div className="va-upgrade-prompt">
            <p>📊 Visual charts (line, bar, heatmap, pie) available on Business plan.</p>
            <a
              href={buildWhatsAppUpgradeUrl('advanced_reports')}
              target="_blank"
              rel="noopener noreferrer"
              className="reports-export-btn"
            >
              Upgrade to Business
            </a>
          </div>
        </>
      )}

      <div className="reports-legacy">
        <h3 className="reports-legacy-title">Export & detailed tables</h3>

        <section className="reports-section">
          <div className="reports-section-header">
            <h3>Therapist Performance</h3>
            <span className="reports-muted">{periodLabel} (synced with dashboard period)</span>
          </div>

          {perfError && <p className="reports-error">{perfError}</p>}
          {perfLoading ? (
            <p className="reports-muted">Loading…</p>
          ) : performance.length === 0 ? (
            <p className="reports-muted">No transactions with therapist data in this period.</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Therapist</th>
                    <th>Sessions</th>
                    <th>Revenue</th>
                    <th>Avg / session</th>
                    <th>Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {performance.map(row => (
                    <tr key={row.therapistKey}>
                      <td>{row.therapistName}</td>
                      <td>{row.sessionCount}</td>
                      <td>{formatAUD(row.totalRevenue)}</td>
                      <td>{formatAUD(row.avgSessionValue)}</td>
                      <td>{formatAUD(row.commissionEarned)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="reports-section">
          <h3>Revenue export</h3>
          <p className="reports-muted">
            Download CSV: date, transaction_id, service, amount, GST, payment_method, customer
          </p>
          {exportError && <p className="reports-error">{exportError}</p>}
          <div className="reports-export-row">
            <label>
              From
              <input type="date" value={exportStart} onChange={e => setExportStart(e.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={exportEnd} onChange={e => setExportEnd(e.target.value)} />
            </label>
            <button
              type="button"
              className="reports-export-btn"
              disabled={exportLoading}
              onClick={handleRevenueExport}
            >
              {exportLoading ? 'Exporting…' : 'Download CSV'}
            </button>
            <button
              type="button"
              className="reports-export-btn secondary"
              disabled={exportLoading}
              onClick={handleMonthExport}
            >
              This month
            </button>
          </div>
        </section>

        <section className="reports-section">
          <div className="reports-section-header">
            <h3>Commission report</h3>
            <label className="reports-month-picker">
              Month
              <input
                type="month"
                value={commissionMonth}
                onChange={e => setCommissionMonth(e.target.value)}
              />
            </label>
          </div>
          <button
            type="button"
            className="reports-export-btn"
            disabled={commission.length === 0}
            onClick={() => exportCommissionCsv(commission, commissionMonth)}
          >
            Export commission CSV
          </button>
          {commissionLoading ? (
            <p className="reports-muted">Loading…</p>
          ) : commission.length === 0 ? (
            <p className="reports-muted">No commission data for this month.</p>
          ) : (
            <div className="reports-table-wrap">
              <table className="reports-table">
                <thead>
                  <tr>
                    <th>Therapist</th>
                    <th>Sessions</th>
                    <th>Gross revenue</th>
                    <th>Rate</th>
                    <th>Owed</th>
                  </tr>
                </thead>
                <tbody>
                  {commission.map(row => (
                    <tr key={row.therapistId}>
                      <td>{row.therapistName}</td>
                      <td>{row.sessionCount}</td>
                      <td>{formatAUD(row.grossRevenue)}</td>
                      <td>{Math.round(row.commissionRate * 100)}%</td>
                      <td>{formatAUD(row.commissionOwed)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
