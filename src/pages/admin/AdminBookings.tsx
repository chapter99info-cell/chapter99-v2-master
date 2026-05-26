import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type BookingStatus = 'pending' | 'confirmed' | 'completed'

type TripBookingRow = {
  id: string
  full_name: string
  phone: string
  trip_type: string
  num_people: number
  status: string
  created_at: string
  slip_url: string | null
}

const STATUS_CYCLE: BookingStatus[] = ['pending', 'confirmed', 'completed']

function nextStatus(current: string): BookingStatus {
  const idx = STATUS_CYCLE.indexOf(current as BookingStatus)
  if (idx < 0) return 'pending'
  return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function tripLabel(id: string): string {
  return id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function AdminBookings() {
  const [rows, setRows] = useState<TripBookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from('trip_bookings')
      .select('id,full_name,phone,trip_type,num_people,status,created_at,slip_url')
      .order('created_at', { ascending: false })
      .limit(200)
    if (err) {
      setError(err.message)
      setRows([])
    } else {
      setRows((data ?? []) as TripBookingRow[])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const cycleStatus = async (row: TripBookingRow) => {
    const next = nextStatus(row.status)
    const { error: err } = await supabase.from('trip_bookings').update({ status: next }).eq('id', row.id)
    if (err) {
      setError(err.message)
      return
    }
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, status: next } : r)))
  }

  return (
    <div className="ab-root">
      <div className="ab-toolbar">
        <h2 className="ab-title">📋 รายการจองทริป</h2>
        <button type="button" className="ab-refresh" onClick={() => void load()}>
          รีเฟรช
        </button>
      </div>

      {loading && <p className="ab-muted">กำลังโหลด…</p>}
      {error && <p className="ab-err">{error}</p>}

      {!loading && !error && rows.length === 0 && <p className="ab-muted">ยังไม่มีการจอง</p>}

      <div className="ab-tablewrap">
        <table className="ab-table">
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>เบอร์</th>
              <th>ทริป</th>
              <th>คน</th>
              <th>สถานะ</th>
              <th>วันที่</th>
              <th>สลิป</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.full_name}</td>
                <td className="ab-mono">{r.phone}</td>
                <td>{tripLabel(r.trip_type)}</td>
                <td>{r.num_people}</td>
                <td>
                  <button type="button" className={`ab-status ab-status--${r.status}`} onClick={() => void cycleStatus(r)}>
                    {r.status}
                  </button>
                </td>
                <td className="ab-mono ab-date">{formatDate(r.created_at)}</td>
                <td>
                  {r.slip_url ? (
                    <button type="button" className="ab-slipbtn" onClick={() => setSlipPreview(r.slip_url)}>
                      <img src={r.slip_url} alt="สลิป" className="ab-slipthumb" />
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {slipPreview && (
        <div className="ab-modal" role="dialog" aria-modal="true">
          <button type="button" className="ab-modalclose" onClick={() => setSlipPreview(null)}>
            ปิด
          </button>
          <img src={slipPreview} alt="สลิปเต็ม" className="ab-modalimg" />
        </div>
      )}

      <style>{`
        .ab-root { padding: 0 0 24px; }
        .ab-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:16px; }
        .ab-title { margin:0; font-size:1.1rem; color:#e8c96a; font-family:'Playfair Display',serif; }
        .ab-refresh {
          border:1px solid rgba(201,168,76,0.45);
          background:rgba(201,168,76,0.12);
          color:#c9a84c;
          padding:8px 12px;
          border-radius:8px;
          font-size:12px;
          font-weight:700;
          cursor:pointer;
        }
        .ab-muted { color:#8a8070; font-size:13px; }
        .ab-err { color:#f88; font-size:13px; }
        .ab-tablewrap { overflow-x:auto; border:1px solid #2a2520; border-radius:12px; }
        .ab-table { width:100%; border-collapse:collapse; font-size:12px; }
        .ab-table th, .ab-table td { padding:10px 8px; border-bottom:1px solid #2a2520; text-align:left; }
        .ab-table th { color:#c9a84c; font-size:10px; text-transform:uppercase; letter-spacing:0.06em; background:#141414; }
        .ab-table tr:hover td { background:#1c1c1c; }
        .ab-mono { font-family:ui-monospace,monospace; }
        .ab-date { white-space:nowrap; font-size:11px; color:#8a8070; }
        .ab-status {
          border:none;
          border-radius:999px;
          padding:4px 10px;
          font-size:10px;
          font-weight:800;
          text-transform:uppercase;
          cursor:pointer;
        }
        .ab-status--pending { background:rgba(201,168,76,0.2); color:#e8c96a; }
        .ab-status--confirmed { background:rgba(100,200,120,0.2); color:#8fd4a0; }
        .ab-status--completed { background:rgba(120,120,120,0.25); color:#bbb; }
        .ab-slipbtn { border:none; background:transparent; padding:0; cursor:pointer; }
        .ab-slipthumb { width:40px; height:40px; object-fit:cover; border-radius:6px; border:1px solid #2a2520; }
        .ab-modal {
          position:fixed; inset:0; z-index:200;
          background:rgba(0,0,0,0.85);
          display:flex; flex-direction:column; align-items:center; justify-content:center;
          padding:20px;
        }
        .ab-modalclose {
          align-self:flex-end;
          margin-bottom:12px;
          border:1px solid #2a2520;
          background:#141414;
          color:#f5f0e8;
          padding:8px 14px;
          border-radius:8px;
          cursor:pointer;
        }
        .ab-modalimg { max-width:100%; max-height:85vh; object-fit:contain; border-radius:12px; }
      `}</style>
    </div>
  )
}
