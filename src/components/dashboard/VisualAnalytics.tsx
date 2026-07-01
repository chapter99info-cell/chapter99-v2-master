import { useCallback, useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { formatAUD } from '../../lib/posCalc'
import {
  fetchVisualAnalytics,
  type VisualAnalyticsData,
} from '../../lib/visualAnalyticsService'

const CHART_COLORS = ['#2D5016', '#C8A84B', '#378ADD', '#EF9F27', '#D4537E']
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const HOUR_LABELS = Array.from({ length: 14 }, (_, i) => `${i + 10}`)

interface VisualAnalyticsProps {
  shopId: string
}

function heatColor(count: number, max: number): string {
  if (count === 0 || max === 0) return '#F3F4F6'
  const intensity = count / max
  if (intensity > 0.7) return '#2D5016'
  if (intensity > 0.4) return '#5A8A3A'
  if (intensity > 0.15) return '#A8C686'
  return '#D4E4C4'
}

export default function VisualAnalytics({ shopId }: VisualAnalyticsProps) {
  const [data, setData] = useState<VisualAnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setData(await fetchVisualAnalytics(shopId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) return <p className="reports-muted">Loading visual analytics…</p>
  if (error) return <p className="reports-error">{error}</p>
  if (!data) return null

  const maxHeat = Math.max(...data.bookingHeatmap.map(c => c.count), 1)

  return (
    <div className="visual-analytics">
      <h3 className="rd-section-title">Visual Analytics — Business</h3>

      <section className="va-chart-card">
        <h4>Daily revenue — last 30 days</h4>
        <div className="va-chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.dailyRevenue30}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatAUD(v)} />
              <Line type="monotone" dataKey="revenue" stroke="#2D5016" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="va-chart-card">
        <h4>Revenue by payment method — this month</h4>
        <div className="va-chart-wrap">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.paymentMethodsMonth}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="method" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: number) => formatAUD(v)} />
              <Bar dataKey="amount" fill="#C8A84B" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="va-chart-card">
        <h4>Booking heatmap — day × hour</h4>
        <div className="va-heatmap-wrap">
          <table className="va-heatmap">
            <thead>
              <tr>
                <th />
                {HOUR_LABELS.map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DAY_LABELS.map((dayLabel, dayIdx) => (
                <tr key={dayLabel}>
                  <th>{dayLabel}</th>
                  {HOUR_LABELS.map((_, hi) => {
                    const hour = hi + 10
                    const cell = data.bookingHeatmap.find(
                      c => c.day === dayIdx && c.hour === hour
                    )
                    const count = cell?.count ?? 0
                    return (
                      <td
                        key={`${dayIdx}-${hour}`}
                        style={{ background: heatColor(count, maxHeat) }}
                        title={`${count} bookings`}
                      >
                        {count > 0 ? count : ''}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="va-bottom-row">
        <section className="va-chart-card">
          <h4>Top 5 services by revenue</h4>
          <div className="va-chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data.topServices}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {data.topServices.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatAUD(v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="va-chart-card">
          <h4>Revenue per staff member</h4>
          <div className="va-chart-wrap">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={data.staffRevenue} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis type="number" tickFormatter={v => `$${v}`} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatAUD(v)} />
                <Bar dataKey="revenue" fill="#378ADD" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </div>
  )
}
