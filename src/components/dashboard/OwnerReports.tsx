import { useEffect, useState } from 'react'
import { formatAUD } from '../../lib/posCalc'
import { fetchShop } from '../../lib/shopService'
import {
  type ReportPeriod,
  fetchTherapistPerformance,
  fetchCommissionReport,
  fetchTransactionsForExport,
  exportTransactionsCsv,
  exportCommissionCsv,
  getMonthBounds,
  getExportRangeBounds,
} from '../../lib/reportService'
import ReportsDashboard from './ReportsDashboard'
import './OwnerReports.css'

interface OwnerReportsProps {
  shopId: string
}

export default function OwnerReports({ shopId }: OwnerReportsProps) {
  const [shopName, setShopName] = useState('ร้าน')
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
  const [exportError, setExportError] = useState('')

  const [commissionMonth, setCommissionMonth] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [commission, setCommission] = useState<Awaited<ReturnType<typeof fetchCommissionReport>>>([])
  const [commissionLoading, setCommissionLoading] = useState(true)

  useEffect(() => {
    fetchShop(shopId).then(shop => setShopName(shop.name || 'ร้าน'))
  }, [shopId])

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
      <ReportsDashboard
        shopId={shopId}
        shopName={shopName}
        period={period}
        onPeriodChange={setPeriod}
      />

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
