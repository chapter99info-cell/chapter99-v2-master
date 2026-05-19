// Chapter99 V4 — Phase 6
// Alert Dashboard Component (PIN 9999 — Owner)
// Shows Insurance / Visa / BAS / Revenue alerts

import { useState, useEffect } from 'react'
import { checkAllAlerts, type Alert, type AlertSeverity } from '../lib/alertSystem'

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
}

interface AlertDashboardProps {
  shopId: string
}

export default function AlertDashboard({ shopId }: AlertDashboardProps) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    checkAllAlerts(shopId).then(a => {
      setAlerts(a)
      setLoading(false)
    })
  }, [shopId])

  const visible = alerts.filter(a => !dismissed.has(a.id))
  const critical = visible.filter(a => a.severity === 'critical')
  const warning = visible.filter(a => a.severity === 'warning')
  const notice = visible.filter(a => a.severity === 'notice')

  const dismiss = (id: string) =>
    setDismissed(prev => new Set([...prev, id]))

  if (loading) {
    return <div className="alert-loading">Checking alerts...</div>
  }

  return (
    <div className="alert-dashboard">
      {/* Summary Bar */}
      <div className="alert-summary">
        <div className="alert-summary-title">
          Staff & Compliance Alerts
        </div>
        <div className="alert-counts">
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
          {visible.length === 0 && (
            <span className="count-badge all-clear">
              ✅ All clear
            </span>
          )}
        </div>
      </div>

      {/* Alert Cards */}
      {visible.length === 0 ? (
        <div className="alert-empty">
          <div className="alert-empty-icon">✅</div>
          <div className="alert-empty-title">No alerts</div>
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
    </div>
  )
}
