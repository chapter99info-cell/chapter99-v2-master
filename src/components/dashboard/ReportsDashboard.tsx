import { useEffect, useRef, useState } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  DoughnutController,
  ArcElement,
} from 'chart.js'
import { formatAUD } from '../../lib/posCalc'
import {
  type ReportPeriod,
  type ReportsDashboardData,
  fetchReportsDashboard,
} from '../../lib/reportService'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  DoughnutController,
  ArcElement
)

const CHART_REVENUE = '#1a3d2b'
const CHART_EXPENSE = '#E24B4A'
const CHART_PROFIT = '#378ADD'

const PERIOD_OPTIONS: { id: ReportPeriod; label: string }[] = [
  { id: 'today', label: 'วันนี้' },
  { id: 'week', label: 'สัปดาห์นี้' },
  { id: 'month', label: 'เดือนนี้' },
]

interface ReportsDashboardProps {
  shopId: string
  shopName: string
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
}

function formatChangePct(pct: number | null): string {
  if (pct === null) return 'ไม่มีข้อมูลเปรียบเทียบ'
  if (pct === 0) return '0% เท่ากับช่วงก่อนหน้า'
  const sign = pct > 0 ? '+' : ''
  return `${sign}${pct}% เทียบช่วงก่อนหน้า`
}

function changeClass(pct: number | null): string {
  if (pct === null || pct === 0) return 'rd-metric-change neutral'
  return pct > 0 ? 'rd-metric-change up' : 'rd-metric-change down'
}

export default function ReportsDashboard({
  shopId,
  shopName,
  period,
  onPeriodChange,
}: ReportsDashboardProps) {
  const [data, setData] = useState<ReportsDashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const barCanvasRef = useRef<HTMLCanvasElement>(null)
  const donutCanvasRef = useRef<HTMLCanvasElement>(null)
  const barChartRef = useRef<Chart | null>(null)
  const donutChartRef = useRef<Chart | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchReportsDashboard(shopId, period)
      .then(result => {
        if (!cancelled) setData(result)
      })
      .catch(e => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'โหลดรายงานไม่สำเร็จ')
          setData(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [shopId, period])

  useEffect(() => {
    if (!data || !barCanvasRef.current) return

    barChartRef.current?.destroy()
    const ctx = barCanvasRef.current.getContext('2d')
    if (!ctx) return

    barChartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: data.daily.map(d => d.label),
        datasets: [
          {
            label: 'รายรับ',
            data: data.daily.map(d => d.revenue),
            backgroundColor: CHART_REVENUE,
            borderRadius: 4,
          },
          {
            label: 'รายจ่าย (ค่าคอม)',
            data: data.daily.map(d => d.commission),
            backgroundColor: CHART_EXPENSE,
            borderRadius: 4,
          },
          {
            label: 'กำไรสุทธิ',
            data: data.daily.map(d => d.profit),
            backgroundColor: CHART_PROFIT,
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const label = ctx.dataset.label ?? ''
                const val = ctx.parsed.y ?? 0
                return `${label}: ${formatAUD(val)}`
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { maxRotation: 45, minRotation: 0, font: { size: 11 } },
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: value => formatAUD(Number(value)),
              font: { size: 11 },
            },
          },
        },
      },
    })

    return () => {
      barChartRef.current?.destroy()
      barChartRef.current = null
    }
  }, [data])

  useEffect(() => {
    if (!data || !donutCanvasRef.current) return

    donutChartRef.current?.destroy()
    const ctx = donutCanvasRef.current.getContext('2d')
    if (!ctx) return

    const hasServices = data.services.length > 0
    donutChartRef.current = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: hasServices ? data.services.map(s => s.name) : ['ไม่มีข้อมูล'],
        datasets: [
          {
            data: hasServices ? data.services.map(s => s.amount) : [1],
            backgroundColor: hasServices
              ? data.services.map(s => s.color)
              : ['#e8e4dc'],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => {
                const slice = data.services[ctx.dataIndex]
                if (!slice) return ''
                return `${slice.name}: ${formatAUD(slice.amount)} (${slice.pct}%)`
              },
            },
          },
        },
      },
    })

    return () => {
      donutChartRef.current?.destroy()
      donutChartRef.current = null
    }
  }, [data])

  const metrics = data?.metrics

  return (
    <div className="reports-dashboard">
      <header className="rd-topbar">
        <h2 className="rd-title">รายงานร้าน — {shopName}</h2>
        <div className="rd-period-tabs" role="tablist" aria-label="ช่วงเวลา">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              role="tab"
              aria-selected={period === opt.id}
              className={`rd-period-btn${period === opt.id ? ' active' : ''}`}
              onClick={() => onPeriodChange(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </header>

      {error && <p className="reports-error">{error}</p>}
      {loading && <p className="reports-muted">กำลังโหลดรายงาน…</p>}

      {!loading && data && metrics && (
        <>
          <div className="rd-metrics">
            <div className="rd-metric-card">
              <span className="rd-metric-label">รายรับ</span>
              <span className="rd-metric-value">{formatAUD(metrics.revenue)}</span>
              <span className={changeClass(metrics.revenueChangePct)}>
                {formatChangePct(metrics.revenueChangePct)}
              </span>
            </div>
            <div className="rd-metric-card">
              <span className="rd-metric-label">รายจ่าย</span>
              <span className="rd-metric-value expense">{formatAUD(metrics.commission)}</span>
              <span className={changeClass(metrics.commissionChangePct)}>
                {formatChangePct(metrics.commissionChangePct)}
              </span>
            </div>
            <div className="rd-metric-card">
              <span className="rd-metric-label">กำไรสุทธิ</span>
              <span className="rd-metric-value profit">{formatAUD(metrics.profit)}</span>
              <span className={changeClass(metrics.profitChangePct)}>
                {formatChangePct(metrics.profitChangePct)}
              </span>
            </div>
          </div>

          <section className="rd-chart-section">
            <h3 className="rd-section-title">รายรับ vs รายจ่าย vs กำไร รายวัน</h3>
            <ul className="rd-legend rd-legend-bar" aria-hidden>
              <li>
                <span className="rd-legend-swatch" style={{ background: CHART_REVENUE }} />
                รายรับ
              </li>
              <li>
                <span className="rd-legend-swatch" style={{ background: CHART_EXPENSE }} />
                รายจ่าย (ค่าคอม)
              </li>
              <li>
                <span className="rd-legend-swatch" style={{ background: CHART_PROFIT }} />
                กำไรสุทธิ
              </li>
            </ul>
            <div className="rd-chart-wrap rd-chart-wrap-bar">
              <canvas ref={barCanvasRef} />
            </div>
          </section>

          <div className="rd-bottom-row">
            <section className="rd-card">
              <h3 className="rd-section-title">สัดส่วน service</h3>
              <div className="rd-donut-layout">
                <div className="rd-chart-wrap rd-chart-wrap-donut">
                  <canvas ref={donutCanvasRef} />
                </div>
                {data.services.length > 0 ? (
                  <ul className="rd-legend rd-legend-donut">
                    {data.services.map(s => (
                      <li key={s.name}>
                        <span className="rd-legend-swatch" style={{ background: s.color }} />
                        <span className="rd-legend-text">
                          {s.name} — {formatAUD(s.amount)} ({s.pct}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="reports-muted">ยังไม่มีรายการบริการในช่วงนี้</p>
                )}
              </div>
            </section>

            <section className="rd-card">
              <h3 className="rd-section-title">ค่าคอมนักบำบัด</h3>
              {data.therapists.length === 0 ? (
                <p className="reports-muted">ยังไม่มีค่าคอมในช่วงนี้</p>
              ) : (
                <ul className="rd-commission-list">
                  {data.therapists.map(t => (
                    <li key={t.therapistId} className="rd-commission-row">
                      <div className="rd-commission-head">
                        <span className="rd-commission-name">{t.therapistName}</span>
                        <span className="rd-commission-amount">{formatAUD(t.commission)}</span>
                      </div>
                      <div className="rd-commission-bar-track">
                        <div
                          className="rd-commission-bar-fill"
                          style={{ width: `${Math.max(t.pct, 2)}%` }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  )
}
