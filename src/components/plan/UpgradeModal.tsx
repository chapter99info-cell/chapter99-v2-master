import { PLAN_COMPARISON_ROWS, PLAN_LABELS, type ShopPlan } from '../../types/plan'
import './UpgradeModal.css'

interface UpgradeModalProps {
  featureLabel: string
  requiredPlan: ShopPlan
  currentPlan: ShopPlan
  onClose: () => void
}

export default function UpgradeModal({
  featureLabel,
  requiredPlan,
  currentPlan,
  onClose,
}: UpgradeModalProps) {
  return (
    <div className="upgrade-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="upgrade-modal"
        role="dialog"
        aria-labelledby="upgrade-modal-title"
        onClick={e => e.stopPropagation()}
      >
        <button type="button" className="upgrade-modal-close" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="upgrade-modal-eyebrow">🔒 Upgrade required</p>
        <h2 id="upgrade-modal-title" className="upgrade-modal-title">
          Unlock {featureLabel}
        </h2>
        <p className="upgrade-modal-lead">
          Your shop is on <strong>{PLAN_LABELS[currentPlan]}</strong>. Upgrade to{' '}
          <strong>{PLAN_LABELS[requiredPlan]}</strong> (or enable the matching add-on) to use this
          feature.
        </p>

        <div className="upgrade-table-wrap">
          <table className="upgrade-table">
            <thead>
              <tr>
                <th>Feature</th>
                <th>Starter</th>
                <th>Growth</th>
                <th>Pro</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_COMPARISON_ROWS.map(row => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.starter ? '✓' : '—'}</td>
                  <td>{row.growth ? '✓' : '—'}</td>
                  <td>{row.pro ? '✓' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="upgrade-modal-actions">
          <a
            className="upgrade-contact-btn"
            href="https://chapter99info.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact Chapter99 to upgrade
          </a>
          <button type="button" className="upgrade-dismiss-btn" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  )
}
