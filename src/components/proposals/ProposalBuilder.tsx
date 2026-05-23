// Chapter99 V4 — Phase 7
// Proposal Builder (PIN 3501)
// Reuses Pricing from locked system prompt

import { useState } from 'react'
import { formatAUD } from '../../lib/posCalc'

// ── Locked Pricing (from system prompt PIN 3501) ──────────────
const TIERS = {
  starter: { setup: 199, monthly: 69, label: 'Starter', prop: 'Digital Kickstart with AI' },
  growth: { setup: 499, monthly: 129, label: 'Growth', prop: 'Full Experience & Engagement' },
  pro: { setup: 899, monthly: 199, label: 'Pro', prop: 'Market Leader & AU Compliance' },
}

const BUNDLES = {
  starter: { name: 'Digital Quickstart Bundle', total: 118, items: 'Starter $69 + AI Content $49' },
  growth: { name: 'Growth Engagement Bundle', total: 197, items: 'Growth $129 + SMS $19 + Google $49' },
  pro: { name: 'Pro Market Leader Bundle', total: 417, items: 'Pro $199 + Social $149 + SMS Unlimited $69' },
}

const ADDONS = [
  { id: 'photo_basic', label: 'Photography Session', price: 299, type: 'one-time' },
  { id: 'photo_premium', label: 'Premium Photo + Reel', price: 499, type: 'one-time' },
  { id: 'content_monthly', label: 'Monthly Content Shoot', price: 199, type: 'monthly' },
  { id: 'reels_extra', label: 'Extra Reels', price: 99, type: 'per-clip' },
  { id: 'sms_200', label: 'SMS Extra 200', price: 19, type: 'monthly' },
  { id: 'sms_500', label: 'SMS Extra 500', price: 39, type: 'monthly' },
  { id: 'sms_unlimited', label: 'SMS Unlimited', price: 69, type: 'monthly' },
  { id: 'google_biz', label: 'Google Business Mgmt', price: 49, type: 'monthly' },
  { id: 'social_media', label: 'Social Media Mgmt', price: 149, type: 'monthly' },
  { id: 'seo_local', label: 'SEO Local Pack', price: 99, type: 'monthly' },
  { id: 'ai_content', label: 'AI Content Monthly', price: 49, type: 'monthly' },
  { id: 'extra_branch', label: 'Extra Branch/Location', price: 49, type: 'monthly' },
  { id: 'priority_support', label: 'Priority Support', price: 49, type: 'monthly' },
]

interface ProposalBuilderProps {
  onClose: () => void
}

export default function ProposalBuilder({ onClose }: ProposalBuilderProps) {
  const [shopName, setShopName] = useState('')
  const [location, setLocation] = useState('')
  const [tier, setTier] = useState<keyof typeof TIERS>('growth')
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [view, setView] = useState<'build' | 'preview'>('build')

  const t = TIERS[tier]
  const b = BUNDLES[tier]

  const addonTotal = selectedAddons.reduce((sum, id) => {
    const a = ADDONS.find(x => x.id === id)
    return sum + (a?.price ?? 0)
  }, 0)

  const monthlyTotal = t.monthly + addonTotal
  const year1 = t.setup + monthlyTotal * 12

  function toggleAddon(id: string) {
    setSelectedAddons(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSend() {
    // In real app: POST to /api/proposals → sends email via Resend
    alert(`Proposal sent to ${shopName}!\n\nIn production this emails the proposal PDF.`)
  }

  const selectedAddonDetails = selectedAddons.map(id => ADDONS.find(a => a.id === id)!)

  return (
    <div className="proposal-builder">
      <div className="proposal-header">
        <div className="proposal-title">Proposal Builder</div>
        <div className="proposal-tabs">
          <button className={`p-tab${view === 'build' ? ' active' : ''}`} onClick={() => setView('build')}>Build</button>
          <button className={`p-tab${view === 'preview' ? ' active' : ''}`} onClick={() => setView('preview')}>Preview</button>
        </div>
      </div>

      {view === 'build' ? (
        <div className="proposal-body">
          {/* Client Info */}
          <div className="p-section">Client</div>
          <input className="p-input" placeholder="Shop name *"
            value={shopName} onChange={e => setShopName(e.target.value)} />
          <input className="p-input" placeholder="Location (e.g. Sydney NSW)"
            value={location} onChange={e => setLocation(e.target.value)} />

          {/* Tier */}
          <div className="p-section">Select Tier</div>
          <div className="tier-selector">
            {(Object.entries(TIERS) as any[]).map(([key, cfg]) => (
              <div
                key={key}
                className={`tier-opt${tier === key ? ' selected' : ''}`}
                onClick={() => setTier(key)}
              >
                <div className="tier-opt-name">{cfg.label}</div>
                <div className="tier-opt-setup">${cfg.setup} setup</div>
                <div className="tier-opt-mo">${cfg.monthly}/mo</div>
                <div className="tier-opt-prop">{cfg.prop}</div>
              </div>
            ))}
          </div>

          {/* Bundle highlight */}
          <div className="bundle-highlight">
            <div className="bundle-highlight-name">⭐ {b.name}</div>
            <div className="bundle-highlight-items">{b.items}</div>
            <div className="bundle-highlight-total">~${b.total}/month</div>
          </div>

          {/* Add-ons */}
          <div className="p-section">Add-ons</div>
          <div className="addon-grid">
            {ADDONS.map(a => (
              <div
                key={a.id}
                className={`addon-opt${selectedAddons.includes(a.id) ? ' selected' : ''}`}
                onClick={() => toggleAddon(a.id)}
              >
                <div className="addon-opt-name">{a.label}</div>
                <div className="addon-opt-price">
                  ${a.price}/{a.type === 'one-time' ? 'once' : a.type === 'per-clip' ? 'clip' : 'mo'}
                </div>
              </div>
            ))}
          </div>

          {/* Notes */}
          <div className="p-section">Notes</div>
          <textarea className="p-textarea" placeholder="Additional notes or special terms..."
            value={notes} onChange={e => setNotes(e.target.value)} rows={3} />

          {/* Summary */}
          <div className="proposal-summary">
            <div className="sum-row"><span>Setup (one-time)</span><span>{formatAUD(t.setup)}</span></div>
            <div className="sum-row"><span>Monthly subscription</span><span>{formatAUD(t.monthly)}</span></div>
            {selectedAddonDetails.map(a => (
              <div key={a.id} className="sum-row addon">
                <span>{a.label}</span>
                <span>{formatAUD(a.price)}/{a.type === 'one-time' ? 'once' : 'mo'}</span>
              </div>
            ))}
            <div className="sum-divider" />
            <div className="sum-row total"><span>Monthly Total</span><span>{formatAUD(monthlyTotal)}</span></div>
            <div className="sum-row year1"><span>Year 1 Investment</span><span>{formatAUD(year1)}</span></div>
          </div>

          <div className="proposal-actions">
            <button className="p-btn secondary" onClick={() => setView('preview')}>Preview →</button>
            <button className="p-btn primary" onClick={handleSend} disabled={!shopName}>
              ✉️ Send Proposal
            </button>
          </div>
        </div>
      ) : (
        /* Preview */
        <div className="proposal-preview">
          <div className="preview-header">
            <div className="preview-logo">Chapter99</div>
            <div className="preview-title">Digital Growth Proposal</div>
            <div className="preview-sub">Prepared for {shopName || '[Shop Name]'} · {location}</div>
            <div className="preview-date">
              {new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}
              {' '}· Valid 14 days
            </div>
          </div>

          <div className="preview-tier">
            <div className="preview-tier-name">{t.label}</div>
            <div className="preview-tier-setup">{formatAUD(t.setup)} one-time setup</div>
            <div className="preview-tier-mo">{formatAUD(t.monthly)} / month</div>
            <div className="preview-tier-prop">{t.prop}</div>
          </div>

          {selectedAddonDetails.length > 0 && (
            <div className="preview-addons">
              <div className="preview-addons-title">Add-ons Selected</div>
              {selectedAddonDetails.map(a => (
                <div key={a.id} className="preview-addon-row">
                  <span>{a.label}</span>
                  <span>{formatAUD(a.price)}/{a.type === 'one-time' ? 'once' : 'mo'}</span>
                </div>
              ))}
            </div>
          )}

          <div className="preview-totals">
            <div className="preview-total-row">
              <span>Monthly Total</span>
              <span className="preview-total-val">{formatAUD(monthlyTotal)}</span>
            </div>
            <div className="preview-total-row year">
              <span>Year 1 Investment</span>
              <span className="preview-total-val">{formatAUD(year1)}</span>
            </div>
          </div>

          {notes && <div className="preview-notes">{notes}</div>}

          <div className="preview-roi">
            <div className="roi-item"><strong>60%</strong><span>reduction in admin work</span></div>
            <div className="roi-item"><strong>24/7</strong><span>online booking</span></div>
            <div className="roi-item"><strong>AU ✅</strong><span>GST & Health Fund ready</span></div>
          </div>

          <div className="proposal-actions">
            <button className="p-btn secondary" onClick={() => setView('build')}>← Edit</button>
            <button className="p-btn primary" onClick={handleSend} disabled={!shopName}>
              ✉️ Send to Client
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
