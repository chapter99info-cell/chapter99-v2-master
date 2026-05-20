// Chapter99 V4 — Phase 4
// Queue Board — iPad Real-time Dashboard
// Staff Briefing + Room Assignment + Walk-in

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import './QueueBoard.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const STATUS_CONFIG: Record<string, { label: string }> = {
  confirmed:   { label: 'Confirmed' },
  arrived:     { label: 'Arrived' },
  in_progress: { label: 'In Progress' },
  completed:   { label: 'Completed' },
  no_show:     { label: 'No Show' },
  cancelled:   { label: 'Cancelled' },
}

interface QueueBoardProps {
  shopId: string
  pinLevel: 'staff' | 'cashier' | 'owner'
  staffId?: string  // if PIN 1111, filter to this staff only
}

export default function QueueBoard({ shopId, pinLevel, staffId }: QueueBoardProps) {
  const [bookings, setBookings] = useState<any[]>([])
  const [briefing, setBriefing] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Real-time subscription
  useEffect(() => {
    loadBookings()

    const channel = supabase
      .channel(`queue-${shopId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bookings',
        filter: `shop_id=eq.${shopId}`,
      }, () => loadBookings())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [shopId, selectedDate, staffId])

  async function loadBookings() {
    setLoading(true)
    const dayStart = `${selectedDate}T00:00:00+10:00`
    const dayEnd = `${selectedDate}T23:59:59+10:00`

    let query = supabase
      .from('bookings')
      .select(`
        id, start_time, end_time, status, source,
        pressure_pref, focus_areas, medical_notes, room_number,
        clients(id, name, phone, medical_flags, allergies, health_fund),
        services(id, name_en, duration, price, gst_free),
        staff(id, name_en)
      `)
      .eq('shop_id', shopId)
      .gte('start_time', dayStart)
      .lte('start_time', dayEnd)
      .neq('status', 'cancelled')
      .order('start_time')

    // Staff PIN: only see own bookings
    if (pinLevel === 'staff' && staffId) {
      query = query.eq('staff_id', staffId)
    }

    const { data } = await query
    setBookings(data ?? [])

    // Load briefing for staff view
    if (pinLevel === 'staff' && staffId) {
      const { data: briefData } = await supabase.rpc('build_staff_briefing', {
        p_shop_id: shopId,
        p_staff_id: staffId,
        p_date: selectedDate,
      })
      setBriefing(briefData)
    }

    setLoading(false)
  }

  async function updateStatus(bookingId: string, status: string) {
    await supabase
      .from('bookings')
      .update({ status })
      .eq('id', bookingId)
  }

  async function assignRoom(bookingId: string, room: string) {
    await supabase
      .from('bookings')
      .update({ room_number: room })
      .eq('id', bookingId)
  }

  const stats = {
    total: bookings.length,
    arrived: bookings.filter(b => b.status === 'arrived').length,
    inProgress: bookings.filter(b => b.status === 'in_progress').length,
    completed: bookings.filter(b => b.status === 'completed').length,
    revenue: bookings
      .filter(b => b.status === 'completed')
      .reduce((s, b) => s + (b.services?.price ?? 0), 0),
  }

  return (
    <div className="queue-board">
      {/* Header */}
      <div className="queue-header">
        <div className="queue-title">
          {pinLevel === 'staff' ? '📋 My Queue' : '📅 Queue Board'}
        </div>
        <input
          type="date"
          className="queue-date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
        />
        <div className="queue-stats">
          <span className="stat">{stats.total} total</span>
          <span className="stat in-progress">{stats.inProgress} active</span>
          <span className="stat done">{stats.completed} done</span>
          {pinLevel !== 'staff' && (
            <span className="stat revenue">${stats.revenue.toFixed(0)}</span>
          )}
        </div>
      </div>

      {/* Staff Briefing (PIN 1111 only) */}
      {pinLevel === 'staff' && briefing?.bookings?.length > 0 && (
        <div className="briefing-banner">
          <div className="briefing-title">📢 Today's Briefing</div>
          <div className="briefing-items">
            {briefing.bookings
              .filter((b: any) => b.medicalFlags?.length > 0 || b.allergies)
              .map((b: any, i: number) => (
                <div key={i} className="briefing-alert">
                  <strong>{b.clientName}</strong> @ {b.time}
                  {b.medicalFlags?.length > 0 && (
                    <span className="medical-flag"> ⚠️ {b.medicalFlags.join(', ')}</span>
                  )}
                  {b.allergies && (
                    <span className="allergy-flag"> 🚫 {b.allergies}</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Booking Cards */}
      {loading ? (
        <div className="queue-loading">Loading queue...</div>
      ) : bookings.length === 0 ? (
        <div className="queue-empty">
          <div className="queue-empty-icon">📅</div>
          <div>No bookings for {selectedDate}</div>
        </div>
      ) : (
        <div className="queue-list">
          {bookings.map(booking => {
            const cfg = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.confirmed
            const isExpanded = expandedId === booking.id
            const time = new Date(booking.start_time)
              .toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
            const endTime = new Date(booking.end_time)
              .toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
            const client = booking.clients
            const svc = booking.services
            const therapist = booking.staff

            return (
              <div key={booking.id} className="queue-card">
                {/* Main Row */}
                <div
                  className="queue-card-main"
                  onClick={() => setExpandedId(isExpanded ? null : booking.id)}
                >
                  <div className="queue-time">
                    <div className="time-start">{time}</div>
                    <div className="time-end">{endTime}</div>
                  </div>

                  <div className="queue-info">
                    <div className="queue-client">
                      {client?.name ?? 'Walk-in'}
                      {booking.source === 'phone' && <span className="source-tag">📞</span>}
                      {booking.source === 'walkin' && <span className="source-tag">🚶</span>}
                    </div>
                    <div className="queue-service">
                      {svc?.name_en} · {svc?.duration} min
                      {pinLevel !== 'staff' && ` · $${svc?.price}`}
                    </div>
                    {pinLevel !== 'staff' && (
                      <div className="queue-therapist">👤 {therapist?.name_en}</div>
                    )}
                  </div>

                  <div className="queue-right">
                    {/* Medical flags */}
                    {(client?.medical_flags?.length > 0 || client?.allergies) && (
                      <span className="flag-medical" title={client.medical_flags?.join(', ')}>⚠️</span>
                    )}
                    {client?.health_fund && <span className="flag-hf" title="Health Fund">❤️</span>}

                    {/* Status badge */}
                    <div
                      className={`status-badge status-badge--${booking.status}`}
                    >
                      {cfg.label}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="queue-card-expanded">
                    {/* Preferences */}
                    <div className="expanded-section">
                      <div className="expanded-label">Preferences</div>
                      <div className="pref-row">
                        <span>Pressure: {['', 'Soft', 'Medium', 'Deep'][booking.pressure_pref ?? 2]}</span>
                        {booking.focus_areas?.length > 0 && (
                          <span>Focus: {booking.focus_areas.join(', ')}</span>
                        )}
                      </div>
                      {booking.medical_notes && (
                        <div className="medical-note">⚠️ {booking.medical_notes}</div>
                      )}
                    </div>

                    {/* Room Assignment (cashier/owner only) */}
                    {pinLevel !== 'staff' && (
                      <div className="expanded-section">
                        <div className="expanded-label">Room</div>
                        <div className="room-selector">
                          {['Room 1', 'Room 2', 'Room 3', 'Bed A', 'Bed B'].map(r => (
                            <button
                              key={r}
                              className={`room-btn${booking.room_number === r ? ' active' : ''}`}
                              onClick={() => assignRoom(booking.id, r)}
                            >
                              {r}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Status Actions */}
                    <div className="status-actions">
                      {booking.status === 'confirmed' && (
                        <button className="action-btn arrived" onClick={() => updateStatus(booking.id, 'arrived')}>
                          ✅ Mark Arrived
                        </button>
                      )}
                      {booking.status === 'arrived' && (
                        <button className="action-btn start" onClick={() => updateStatus(booking.id, 'in_progress')}>
                          ▶️ Start Session
                        </button>
                      )}
                      {booking.status === 'in_progress' && (
                        <button className="action-btn complete" onClick={() => updateStatus(booking.id, 'completed')}>
                          ✅ Complete
                        </button>
                      )}
                      {['confirmed', 'arrived'].includes(booking.status) && (
                        <button className="action-btn noshow" onClick={() => updateStatus(booking.id, 'no_show')}>
                          ❌ No Show
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
