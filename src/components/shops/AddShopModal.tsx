// Chapter99 V4 — Phase 7
// Add New Shop Modal (PIN 3501)
// Creates shop in Supabase + generates config JSON

import { useState } from 'react'
import { createShop } from '../../lib/adminService'
import { PLAN_PRICING, SHOP_PLANS, type ShopPlan } from '../../types/plan'

interface AddShopModalProps {
  onClose: () => void
  onSaved: () => void
}

export default function AddShopModal({ onClose, onSaved }: AddShopModalProps) {
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    abn: '',
    plan: 'growth' as ShopPlan,
    domain: '',
    ownerPin: '9999',
    providerName: '',
    providerNumber: '',
    theme: 'theme-elegant',
  })

  const set = (key: string, val: string) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const shopId = form.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 20)

  async function handleSave() {
    setSaving(true)
    const ok = await createShop({
      id: shopId,
      name: form.name,
      plan: form.plan,
      phone: form.phone,
      email: form.email,
      abn: form.abn,
      address: form.address,
    })
    setSaving(false)
    if (ok) onSaved()
  }

  const plan = PLAN_PRICING[form.plan]

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title">เพิ่มร้านใหม่</div>
          <div className="modal-steps">
            {[1, 2, 3].map(s => (
              <div key={s} className={`step-dot${step >= s ? ' done' : ''}`} />
            ))}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <div className="modal-body">
            <div className="modal-section">ข้อมูลร้าน</div>
            <input className="modal-input" placeholder="ชื่อร้าน *"
              value={form.name} onChange={e => set('name', e.target.value)} />
            <input className="modal-input" placeholder="Email *"
              value={form.email} onChange={e => set('email', e.target.value)} />
            <input className="modal-input" placeholder="เบอร์โทร *"
              value={form.phone} onChange={e => set('phone', e.target.value)} />
            <input className="modal-input" placeholder="ที่อยู่ร้าน"
              value={form.address} onChange={e => set('address', e.target.value)} />
            <input className="modal-input" placeholder="ABN (11 หลัก)"
              value={form.abn} onChange={e => set('abn', e.target.value)} />

            <div className="modal-section">Domain</div>
            <input className="modal-input" placeholder="domain.com.au"
              value={form.domain} onChange={e => set('domain', e.target.value)} />
            {shopId && (
              <div className="shop-id-preview">
                Shop ID: <code>{shopId}</code>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Plan + Health Fund */}
        {step === 2 && (
          <div className="modal-body">
            <div className="modal-section">เลือก Plan</div>
            <div className="plan-selector">
              {SHOP_PLANS.map(key => {
                const cfg = PLAN_PRICING[key]
                return (
                  <div
                    key={key}
                    className={`plan-option${form.plan === key ? ' selected' : ''}`}
                    onClick={() => setForm(prev => ({ ...prev, plan: key }))}
                  >
                    <div className="plan-option-name">{cfg.label}</div>
                    <div className="plan-option-price">${cfg.setup} setup</div>
                    <div className="plan-option-mo">${cfg.monthly}/mo</div>
                  </div>
                )
              })}
            </div>

            <div className="modal-section">Health Fund (HICAPS)</div>
            <input className="modal-input" placeholder="Provider Name"
              value={form.providerName} onChange={e => set('providerName', e.target.value)} />
            <input className="modal-input" placeholder="Provider Number (e.g. A348132F)"
              value={form.providerNumber} onChange={e => set('providerNumber', e.target.value)} />

            <div className="modal-section">Theme (หน้าบ้าน)</div>
            <div className="theme-selector">
              {['theme-elegant', 'theme-minimal', 'theme-traditional', 'theme-modern'].map(t => (
                <div
                  key={t}
                  className={`theme-option${form.theme === t ? ' selected' : ''}`}
                  onClick={() => set('theme', t)}
                >
                  {t.replace('theme-', '')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Review + Confirm */}
        {step === 3 && (
          <div className="modal-body">
            <div className="modal-section">ตรวจสอบข้อมูล</div>
            <div className="review-table">
              <ReviewRow label="ชื่อร้าน" value={form.name} />
              <ReviewRow label="Shop ID" value={shopId} />
              <ReviewRow label="Email" value={form.email} />
              <ReviewRow label="Phone" value={form.phone} />
              <ReviewRow label="ABN" value={form.abn} />
              <ReviewRow label="Domain" value={form.domain} />
              <ReviewRow label="Plan" value={`${plan.label} — $${plan.setup} setup + $${plan.monthly}/mo`} />
              <ReviewRow label="Theme" value={form.theme} />
              <ReviewRow label="Provider" value={form.providerName} />
              <ReviewRow label="Provider No." value={form.providerNumber} />
            </div>

            <div className="config-preview">
              <div className="config-label">shop.json ที่จะสร้าง</div>
              <pre className="config-json">{JSON.stringify({
                shopId,
                name: form.name,
                plan: form.plan,
                planLabel: plan.label,
                setupFee: plan.setup,
                monthlyFee: plan.monthly,
                domain: form.domain,
                theme: form.theme,
                abn: form.abn,
                phone: form.phone,
                email: form.email,
                providerName: form.providerName,
                providerNumber: form.providerNumber,
                pins: { staff: '1111', cashier: '4444', owner: '9999' },
                settings: {
                  gst: 0.10,
                  cardSurcharge: 0.015,
                  timezone: 'Australia/Sydney',
                  currency: 'AUD',
                }
              }, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="modal-footer">
          {step > 1 && (
            <button className="modal-btn secondary" onClick={() => setStep(s => s - 1)}>
              ← ย้อนกลับ
            </button>
          )}
          <div style={{ flex: 1 }} />
          {step < 3 ? (
            <button
              className="modal-btn primary"
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 && (!form.name || !form.email)}
            >
              ถัดไป →
            </button>
          ) : (
            <button
              className="modal-btn primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'กำลังสร้าง...' : '✅ สร้างร้านใหม่'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="review-row">
      <span className="review-label">{label}</span>
      <span className="review-value">{value || '—'}</span>
    </div>
  )
}
