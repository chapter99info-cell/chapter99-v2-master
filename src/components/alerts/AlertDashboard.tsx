// Chapter99 V4 — Phase 6
// Alert Dashboard — compliance alerts + booking notifications

import { useState, useEffect } from 'react'
import { checkAllAlerts, type Alert, type AlertSeverity } from '../../lib/alertSystem'
import {
  fetchBookingNotifications,
  formatNotificationDateTime,
  markAllNotificationsRead,
  roomLabel,
  therapistLabel,
} from '../../lib/notificationService'
import { supabase } from '../../lib/supabase'
import type { AppNotification } from '../../types/notification'
import './AlertDashboard.css'

const SEVERITY_CONFIG: Record<AlertSeverity, {
  bg: string; border: string; text: string; dot: string; label: string
}> = {
  critical: {
    bg: '#FAECE7', border: '#F5C4B3', text: '#993C1D',
    dot: '#E24B4A', label: 'Critical',
  },
  warning: {
    bg: '#FAEEDA', border: '#FAC775', text: '#633806',
    dot: '#BA7517', label: 'Warning',
  },
  notice: {
    bg: '#EAF3DE', border: '#C0DD97', text: '#27500A',
    dot: '#3B6D11', label: 'Notice',
  },
}

const TYPE_ICONS: Record<string, string> = {
  indemnity_insurance: '🛡',
  liability_insurance: '🛡',
  firstaid_cert: '🩺',
  visa_expiry: '🛂',
  bas_due: '📋',
  low_revenue: '📉',
  no_bookings: '📅',
  google_review: '⭐',
  booking: '📅',
}

const BOOKING_CFG = {
  bg: '#E8F4FC',
  border: '#A8D4F0',
  text: '#1A4D6E',
  dot: '#2B7CB0',
}

interface AlertDashboardProps {
  shopId: string
  onMarkedRead?: () => void
}

export default function AlertDashboard({ shopId, onMarkedRead }: AlertDashboardProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [bookings, setBookings] = useState<AppNotification[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      try {
        await markAllNotificationsRead(supabase, shopId)
        onMarkedRead?.()
      } catch {
        /* table may not exist until migration runs */
      }

      const [compliance, bookingNotes] = await Promise.all([
        checkAllAlerts(shopId),
        fetchBookingNotifications(supabase, shopId).catch(() => [] as AppNotification[]),
      ])

      if (!cancelled) {
        setAlerts(compliance)
        setBookings(bookingNotes)
        setLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [shopId, onMarkedRead])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  const critical = visible.filter(a => a.severity === 'critical')
  const warning = visible.filter(a => a.severity === 'warning')
  const notice = visible.filter(a => a.severity === 'notice')
  const totalItems = visible.length + bookings.length

  const dismiss = (id: string) =>
    setDismissed(prev => new Set([...prev, id]))

  if (loading) {
    return <div className="alert-loading">Checking alerts...</div>
  }

  return (
    <div className="alert-dashboard">
      <div className="alert-summary">
        <div className="alert-summary-title">Alerts</div>
        <div className="alert-counts">
          {bookings.length > 0 && (
            <span className="count-badge booking">
              {bookings.length} Booking{bookings.length !== 1 ? 's' : ''}
            </span>
          )}
          {critical.length > 0 && (
            <span className="count-badge critical">
              {critical.length} Critical
            </span>
          )}
          {warning.length > 0 && (
            <span className="count-badge warning">
              {warning.length} Warning
            </span>
          )}
          {notice.length > 0 && (
            <span className="count-badge notice">
              {notice.length} Notice
            </span>
          )}
          {totalItems === 0 && (
            <span className="count-badge all-clear">
              ✅ All clear
            </span>
          )}
        </div>
      </div>

      {bookings.length > 0 && (
        <section className="alert-section">
          <h3 className="alert-section-title">New bookings</h3>
          <div className="alert-list">
            {bookings.map(note => {
              const p = note.payload
              if (!p) return null
              const sourceLabel =
                p.source === 'walkin' ? 'Walk-in' : p.source === 'online' ? 'Online' : p.source

              return (
                <div
                  key={note.id}
                  className={`alert-card booking-card${note.isRead ? ' is-read' : ''}`}
                  style={{
                    background: BOOKING_CFG.bg,
                    borderColor: BOOKING_CFG.border,
                  }}
                >
                  <div className="alert-card-left">
                    <span className="alert-dot" style={{ background: BOOKING_CFG.dot }} />
                    <span className="alert-icon">{TYPE_ICONS.booking}</span>
                    <div className="alert-content">
                      <div className="alert-title" style={{ color: BOOKING_CFG.text }}>
                        New booking · {sourceLabel}
                      </div>
                      <dl className="booking-details" style={{ color: BOOKING_CFG.text }}>
                        <div className="booking-detail-row">
                          <dt>Client</dt>
                          <dd>{p.clientName}</dd>
                        </div>
                        <div className="booking-detail-row">
                          <dt>Service</dt>
                          <dd>{p.serviceName}</dd>
                        </div>
                        <div className="booking-detail-row">
                          <dt>Date & time</dt>
                          <dd>{formatNotificationDateTime(p.appointmentAt)}</dd>
                        </div>
                        <div className="booking-detail-row">
                          <dt>Therapist</dt>
                          <dd>{therapistLabel(p.therapist)}</dd>
                        </div>
                        <div className="booking-detail-row">
                          <dt>Room</dt>
                          <dd>{roomLabel(p.room)}</dd>
                        </div>
                        <div className="booking-detail-row">
                          <dt>Booked</dt>
                          <dd>{formatNotificationDateTime(p.bookedAt)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      <section className="alert-section">
        <h3 className="alert-section-title">Staff & compliance</h3>
        {visible.length === 0 ? (
          <div className="alert-empty">
            <div className="alert-empty-icon">✅</div>
            <div className="alert-empty-title">No compliance alerts</div>
            <div className="alert-empty-sub">
              All documents and compliance are up to date
            </div>
          </div>
        ) : (
          <div className="alert-list">
            {[...critical, ...warning, ...notice].map(alert => {
              const cfg = SEVERITY_CONFIG[alert.severity]
              return (
                <div
                  key={alert.id}
                  className="alert-card"
                  style={{
                    background: cfg.bg,
                    borderColor: cfg.border,
                  }}
                >
                  <div className="alert-card-left">
                    <span className="alert-dot" style={{ background: cfg.dot }} />
                    <span className="alert-icon">
                      {TYPE_ICONS[alert.type] ?? '⚠️'}
                    </span>
                    <div className="alert-content">
                      <div className="alert-title" style={{ color: cfg.text }}>
                        {alert.title}
                      </div>
                      <div className="alert-message" style={{ color: cfg.text }}>
                        {alert.message}
                      </div>
                      {alert.staffName && (
                        <div className="alert-staff">
                          Staff: {alert.staffName}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="alert-card-right">
                    {alert.daysRemaining !== undefined && (
                      <div
                        className="days-badge"
                        style={{
                          color: cfg.text,
                          borderColor: cfg.border,
                        }}
                      >
                        {alert.daysRemaining <= 0
                          ? 'EXPIRED'
                          : `${alert.daysRemaining}d`}
                      </div>
                    )}
                    <div className="alert-actions">
                      {alert.actionUrl && (
                        <a
                          href={alert.actionUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="alert-action-btn"
                          style={{ color: cfg.text, borderColor: cfg.border }}
                        >
                          View →
                        </a>
                      )}
                      <button
                        className="alert-dismiss"
                        onClick={() => dismiss(alert.id)}
                        aria-label="Dismiss alert"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
