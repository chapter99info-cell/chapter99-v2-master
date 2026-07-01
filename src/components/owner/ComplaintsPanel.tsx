import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export interface ComplaintRow {
  id: string
  shopId: string
  bookingId: string | null
  clientId: string | null
  rating: number
  message: string | null
  createdAt: string
  resolved: boolean
}

interface ComplaintsPanelProps {
  shopId: string
}

export default function ComplaintsPanel({ shopId }: ComplaintsPanelProps) {
  const [complaints, setComplaints] = useState<ComplaintRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'open' | 'all'>('open')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    let query = supabase
      .from('complaints')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: false })

    if (filter === 'open') {
      query = query.eq('resolved', false)
    }

    const { data, error: qErr } = await query
    if (qErr) {
      setError(qErr.message)
      setComplaints([])
    } else {
      setComplaints(
        (data ?? []).map(row => ({
          id: row.id as string,
          shopId: row.shop_id as string,
          bookingId: (row.booking_id as string | null) ?? null,
          clientId: (row.client_id as string | null) ?? null,
          rating: row.rating as number,
          message: (row.message as string | null) ?? null,
          createdAt: row.created_at as string,
          resolved: row.resolved === true,
        }))
      )
    }
    setLoading(false)
  }, [shopId, filter])

  useEffect(() => {
    void load()
  }, [load])

  const resolve = async (id: string) => {
    await supabase.from('complaints').update({ resolved: true }).eq('id', id)
    await supabase
      .from('alerts')
      .update({ dismissed: true })
      .eq('id', `complaint-${id}`)
    void load()
  }

  return (
    <div className="complaints-panel">
      <header className="inv-header">
        <h2>Internal Complaints / ข้อร้องเรียน</h2>
        <p className="reports-muted">
          Low ratings (1–3 stars) from the review flow. Resolve after follow-up.
        </p>
        <div className="complaints-filter">
          <button
            type="button"
            className={`rd-period-btn${filter === 'open' ? ' active' : ''}`}
            onClick={() => setFilter('open')}
          >
            Open
          </button>
          <button
            type="button"
            className={`rd-period-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
        </div>
      </header>

      {error && <p className="reports-error">{error}</p>}
      {loading ? (
        <p className="reports-muted">Loading…</p>
      ) : complaints.length === 0 ? (
        <p className="reports-muted">
          {filter === 'open' ? 'No unresolved complaints.' : 'No complaints recorded.'}
        </p>
      ) : (
        <ul className="complaints-list">
          {complaints.map(c => (
            <li key={c.id} className={`complaint-card${c.resolved ? ' resolved' : ''}`}>
              <div className="complaint-head">
                <span className="complaint-stars">{'★'.repeat(c.rating)}{'☆'.repeat(5 - c.rating)}</span>
                <time className="reports-muted">
                  {new Date(c.createdAt).toLocaleString('en-AU', {
                    timeZone: 'Australia/Sydney',
                  })}
                </time>
              </div>
              {c.message && <p className="complaint-message">{c.message}</p>}
              {!c.resolved && (
                <button
                  type="button"
                  className="reports-export-btn"
                  onClick={() => void resolve(c.id)}
                >
                  Mark resolved
                </button>
              )}
              {c.resolved && <span className="complaint-resolved-badge">Resolved</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
