import { useEffect, useState } from 'react'
import { formatAUD } from '../../lib/posCalc'
import {
  type ReportPeriod,
  fetchTherapistPerformance,
  fetchCommissionReport,
  fetchTransactionsForExport,
  exportTransactionsCsv,
  exportCommissionCsv,
  getMonthBounds,
} from '../../lib/reportService'
import './OwnerReports.css'

interface OwnerReportsProps {
  shopId: string
}

export default function OwnerReports({ shopId }: OwnerReportsProps) {
  const [period, setPeriod] = useState<ReportPeriod>('today')
  const [performance, setPerformance] = useState<Awaited<ReturnType<typeof fetchTherapistPerformance>>>([])
  const [perfLoading, setPerfLoading] = useState(true)
  const [perfError, setPerfError] = useState('')

  const [exportStart, setExportStart] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [exportEnd, setExportEnd] = useState(() => new Date().toISOString().slice(0, 10))
  const [exportLoading, setExportLoading] = useState(false)

  const [commissionMonth, setCommissionMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [commission, setCommission] = useState<Awaited<ReturnType<typeof fetchCommissionReport>>>([])
  const [commissionLoading, setCommissionLoading] = useState(true)

  const totals = performance.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.totalRevenue,
      sessions: acc.sessions + r.sessionCount,
      commission: acc.commission + r.commissionEarned,
    }),
    { revenue: 0, sessions: 0, commission: 0 }
  )

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

  const handleRevenueExport = async () => {
    setExportLoading(true)
    try {
      const start = new Date(exportStart + 'T00:00:00')
      const end = new Date(exportEnd + 'T23:59:59')
      end.setDate(end.getDate() + 1)
      const rows = await fetchTransactionsForExport(shopId, start, end)
      exportTransactionsCsv(rows, `${exportStart}_to_${exportEnd}`)
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
      <h2 className="reports-title">Reports</h2>

      <section className="reports-section">
        <div className="reports-section-header">
          <h3>Therapist Performance</h3>
          <div className="reports-period-tabs">
            {(['today', 'week', 'month'] as ReportPeriod[]).map(p => (
              <button
                key={p}
                type="button"
                className={`reports-period-btn${period === p ? ' active' : ''}`}
                onClick={() => setPeriod(p)}
              >
                {p === 'today' ? 'Today' : p === 'week' ? 'This Week' : 'This Month'}
              </button>
            ))}
          </div>
        </div>

        <div className="reports-summary-grid">
          <div className="reports-summary-card">
            <span className="reports-summary-label">Total revenue</span>
            <span className="reports-summary-value">{formatAUD(totals.revenue)}</span>
            <span className="reports-summary-sub">{periodLabel}</span>
          </div>
          <div className="reports-summary-card">
            <span className="reports-summary-label">Sessions</span>
            <span className="reports-summary-value">{totals.sessions}</span>
          </div>
          <div className="reports-summary-card">
            <span className="reports-summary-label">Commission est.</span>
            <span className="reports-summary-value">{formatAUD(totals.commission)}</span>
          </div>
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
        <p className="reports-muted">Download CSV: date, transaction_id, service, amount, GST, payment_method, customer</p>
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
  )
}
