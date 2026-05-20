// Chapter99 V4 — Phase 2
// Staff Management (PIN 4444 = add/edit, PIN 9999 = delete)

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import './StaffManager.css'

interface StaffManagerProps {
  shopId: string
  pinLevel: 'cashier' | 'owner'
}

interface StaffRow {
  id: string
  name_en: string
  name_th: string | null
  role: string
  commission_rate: number
  base_hourly: number | null
  visa_type: string | null
  visa_expiry: string | null
  indemnity_expiry: string | null
  liability_expiry: string | null
  firstaid_expiry: string | null
  employment_type: string | null
  start_date: string | null
  active: boolean
}

interface StaffForm {
  nameEn: string
  nameTh: string
  role: string
  pin: string
  commissionRate: number
  baseHourly: number
  visaType: string
  visaExpiry: string
  indemnityExpiry: string
  liabilityExpiry: string
  firstaidExpiry: string
  employmentType: string
  startDate: string
}

const EMPTY_FORM: StaffForm = {
  nameEn: '',
  nameTh: '',
  role: 'therapist',
  pin: '',
  commissionRate: 40,
  baseHourly: 25,
  visaType: '',
  visaExpiry: '',
  indemnityExpiry: '',
  liabilityExpiry: '',
  firstaidExpiry: '',
  employmentType: 'casual',
  startDate: '',
}

function isFourDigitPin(pin: string): boolean {
  return /^\d{4}$/.test(pin)
}

function roleLabel(role: string): string {
  const labels: Record<string, string> = {
    therapist: 'Therapist',
    cashier: 'Cashier',
    manager: 'Manager',
    owner: 'Owner',
  }
  return labels[role] ?? role
}

function validateStaffForm(form: StaffForm, isEdit: boolean): string | null {
  if (!form.nameEn.trim()) {
    return 'Name is required'
  }
  if (!isEdit) {
    if (!isFourDigitPin(form.pin)) {
      return 'PIN must be exactly 4 digits'
    }
  } else if (form.pin && !isFourDigitPin(form.pin)) {
    return 'New PIN must be exactly 4 digits, or leave blank to keep the current PIN'
  }
  const commission = Number(form.commissionRate)
  if (Number.isNaN(commission) || commission < 0 || commission > 100) {
    return 'Commission must be between 0 and 100'
  }
  const hourly = Number(form.baseHourly)
  if (Number.isNaN(hourly) || hourly < 0) {
    return 'Base hourly rate must be zero or greater'
  }
  return null
}

export default function StaffManager({ shopId, pinLevel }: StaffManagerProps) {
  const [staffList, setStaffList] = useState<StaffRow[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  const isEdit = Boolean(editId)
  const validationError = validateStaffForm(form, isEdit)

  useEffect(() => {
    loadStaff()
  }, [shopId])

  async function loadStaff() {
    if (!shopId) {
      setLoadError('Shop ID is missing — check VITE_SHOP_ID in environment.')
      setStaffList([])
      setLoading(false)
      return
    }

    setLoading(true)
    setLoadError('')
    const { data, error } = await supabase
      .from('staff')
      .select(
        'id, name_en, name_th, role, commission_rate, base_hourly, visa_type, visa_expiry, indemnity_expiry, liability_expiry, firstaid_expiry, employment_type, start_date, active, shop_id, created_at'
      )
      .eq('shop_id', shopId)
      .order('name_en', { ascending: true })

    setLoading(false)

    if (error) {
      setLoadError(
        error.message.includes('policy') || error.code === '42501'
          ? `${error.message} — run supabase/12-staff-manager-rls.sql in Supabase SQL Editor`
          : error.message
      )
      setStaffList([])
      return
    }
    setStaffList((data as StaffRow[]) ?? [])
  }

  function startAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setFormError('')
    setShowForm(true)
  }

  function startEdit(s: StaffRow) {
    setForm({
      nameEn: s.name_en,
      nameTh: s.name_th ?? '',
      role: s.role,
      pin: '',
      commissionRate: Math.round(s.commission_rate * 100),
      baseHourly: s.base_hourly ?? 25,
      visaType: s.visa_type ?? '',
      visaExpiry: s.visa_expiry ?? '',
      indemnityExpiry: s.indemnity_expiry ?? '',
      liabilityExpiry: s.liability_expiry ?? '',
      firstaidExpiry: s.firstaid_expiry ?? '',
      employmentType: s.employment_type ?? 'casual',
      startDate: s.start_date ?? '',
    })
    setEditId(s.id)
    setFormError('')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setFormError('')
  }

  function setPinDigits(value: string) {
    const digits = value.replace(/\D/g, '').slice(0, 4)
    setForm(f => ({ ...f, pin: digits }))
    if (formError) setFormError('')
  }

  async function saveStaff() {
    const err = validateStaffForm(form, isEdit)
    if (err) {
      setFormError(err)
      return
    }

    setSaving(true)
    setFormError('')

    const payload: Record<string, unknown> = {
      shop_id: shopId,
      name_en: form.nameEn.trim(),
      name_th: form.nameTh.trim() || null,
      role: form.role,
      commission_rate: Number(form.commissionRate) / 100,
      base_hourly: Number(form.baseHourly),
      visa_type: form.visaType || null,
      visa_expiry: form.visaExpiry || null,
      indemnity_expiry: form.indemnityExpiry || null,
      liability_expiry: form.liabilityExpiry || null,
      firstaid_expiry: form.firstaidExpiry || null,
      employment_type: form.employmentType,
      start_date: form.startDate || null,
      active: true,
    }

    if (!isEdit) {
      payload.pin_hash = form.pin
    } else if (isFourDigitPin(form.pin)) {
      payload.pin_hash = form.pin
    }

    let error: { message: string } | null = null

    if (isEdit && editId) {
      const result = await supabase.from('staff').update(payload).eq('id', editId).eq('shop_id', shopId)
      error = result.error
    } else {
      const result = await supabase
        .from('staff')
        .insert(payload)
        .select('id')
        .single()
      error = result.error
    }

    setSaving(false)

    if (error) {
      setFormError(error.message)
      return
    }

    closeForm()
    loadStaff()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('staff').update({ active }).eq('id', id)
    loadStaff()
  }

  async function deleteStaff(id: string) {
    await supabase.from('staff').update({ active: false, pin_hash: 'DELETED' }).eq('id', id)
    setConfirmDelete(null)
    loadStaff()
  }

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  }

  const alertColor = (days: number | null) => {
    if (days === null) return ''
    if (days <= 7) return 'critical'
    if (days <= 30) return 'warning'
    if (days <= 60) return 'notice'
    return ''
  }

  return (
    <div className="staff-manager">
      <div className="staff-header">
        <h2 className="staff-title">Staff Management</h2>
        <button type="button" className="add-staff-btn" onClick={startAdd}>
          + เพิ่มพนักงาน
        </button>
      </div>

      {loadError && <p className="staff-banner staff-banner--error">{loadError}</p>}

      {loading && <p className="staff-banner">Loading staff…</p>}

      {!loading && !loadError && staffList.length === 0 && (
        <p className="staff-banner">
          No staff yet for shop <strong>{shopId}</strong>. Add your first team member below.
        </p>
      )}

      <div className="staff-list">
        {staffList.map(s => {
          const indemnityDays = daysUntil(s.indemnity_expiry ?? '')
          const visaDays = daysUntil(s.visa_expiry ?? '')
          const hasAlerts =
            (indemnityDays !== null && indemnityDays <= 60) ||
            (visaDays !== null && visaDays <= 90)

          return (
            <article
              key={s.id}
              className={`staff-card${!s.active ? ' staff-card--suspended' : ''}`}
            >
              <div className="staff-card-top">
                <div className="staff-card-identity">
                  <div className="staff-avatar" aria-hidden>
                    {s.name_en.charAt(0).toUpperCase()}
                  </div>
                  <div className="staff-head">
                    <div className="staff-name-row">
                      <h3 className="staff-name">{s.name_en}</h3>
                      <span className={`staff-role-badge staff-role-badge--${s.role}`}>
                        {roleLabel(s.role)}
                      </span>
                    </div>
                    {s.name_th ? (
                      <p className="staff-nickname">{s.name_th}</p>
                    ) : (
                      <p className="staff-nickname staff-nickname--empty">No nickname</p>
                    )}
                  </div>
                </div>
                <span
                  className={`staff-status ${s.active ? 'staff-status--active' : 'staff-status--suspended'}`}
                >
                  {s.active ? 'Active' : 'Suspended'}
                </span>
              </div>

              <div className="staff-stats">
                <div className="staff-stat">
                  <span className="staff-stat-label">Commission</span>
                  <span className="staff-stat-value">
                    {(s.commission_rate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="staff-stat">
                  <span className="staff-stat-label">Base rate</span>
                  <span className="staff-stat-value">
                    ${Number(s.base_hourly ?? 0).toFixed(2)}/hr
                  </span>
                </div>
              </div>

              {hasAlerts && (
                <div className="staff-alerts">
                  {indemnityDays !== null && indemnityDays <= 60 && (
                    <span className={`staff-alert-tag staff-alert-tag--${alertColor(indemnityDays)}`}>
                      🛡 Insurance · {indemnityDays}d
                    </span>
                  )}
                  {visaDays !== null && visaDays <= 90 && (
                    <span className={`staff-alert-tag staff-alert-tag--${alertColor(visaDays)}`}>
                      🛂 Visa · {visaDays}d
                    </span>
                  )}
                </div>
              )}

              <div className="staff-card-actions">
                <button
                  type="button"
                  className="staff-btn staff-btn--primary"
                  onClick={() => startEdit(s)}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="staff-btn staff-btn--secondary"
                  onClick={() => toggleActive(s.id, !s.active)}
                >
                  {s.active ? 'Suspend' : 'Activate'}
                </button>
                {pinLevel === 'owner' && (
                  <button
                    type="button"
                    className="staff-btn staff-btn--danger"
                    onClick={() => setConfirmDelete(s.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={closeForm}>
          <div
            className="modal-box staff-modal"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-labelledby="staff-form-title"
          >
            <div className="modal-title" id="staff-form-title">
              {isEdit ? 'Edit Staff' : 'Add Staff'}
            </div>

            <div className="form-section">Basic Info</div>
            <input
              className={`form-input${!form.nameEn.trim() && formError ? ' invalid' : ''}`}
              placeholder="Name (English) *"
              value={form.nameEn}
              onChange={e => {
                setForm(f => ({ ...f, nameEn: e.target.value }))
                if (formError) setFormError('')
              }}
            />
            <input
              className="form-input"
              placeholder="Nickname (optional)"
              value={form.nameTh}
              onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))}
            />

            <select
              className="form-input"
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
            >
              <option value="therapist">Therapist</option>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>

            <input
              className={`form-input${form.pin && !isFourDigitPin(form.pin) ? ' invalid' : ''}`}
              placeholder={isEdit ? 'New PIN (4 digits, optional)' : 'PIN (4 digits) *'}
              maxLength={4}
              inputMode="numeric"
              autoComplete="off"
              type="password"
              value={form.pin}
              onChange={e => setPinDigits(e.target.value)}
            />
            <p className="form-hint">
              {isEdit
                ? 'Leave PIN blank to keep the existing login PIN.'
                : 'Staff use this 4-digit PIN to log in (e.g. 1111).'}
            </p>

            <div className="form-section">Pay Structure</div>
            <div className="form-row">
              <div>
                <label className="form-label">Commission %</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  max={100}
                  value={form.commissionRate}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      commissionRate: e.target.value === '' ? 0 : Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div>
                <label className="form-label">Base $/hr</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.baseHourly}
                  onChange={e =>
                    setForm(f => ({
                      ...f,
                      baseHourly: e.target.value === '' ? 0 : Number(e.target.value),
                    }))
                  }
                />
              </div>
            </div>

            <div className="form-section">Documents & Expiry Dates</div>
            <label className="form-label">Professional Indemnity Insurance</label>
            <input
              className="form-input"
              type="date"
              value={form.indemnityExpiry}
              onChange={e => setForm(f => ({ ...f, indemnityExpiry: e.target.value }))}
            />
            <label className="form-label">Public Liability Insurance</label>
            <input
              className="form-input"
              type="date"
              value={form.liabilityExpiry}
              onChange={e => setForm(f => ({ ...f, liabilityExpiry: e.target.value }))}
            />
            <label className="form-label">First Aid Certificate</label>
            <input
              className="form-input"
              type="date"
              value={form.firstaidExpiry}
              onChange={e => setForm(f => ({ ...f, firstaidExpiry: e.target.value }))}
            />

            <div className="form-section">Visa / Work Rights</div>
            <select
              className="form-input"
              value={form.visaType}
              onChange={e => setForm(f => ({ ...f, visaType: e.target.value }))}
            >
              <option value="">Select visa type</option>
              <option value="citizen">Australian Citizen</option>
              <option value="pr">Permanent Resident</option>
              <option value="work">Work Visa</option>
              <option value="student">Student Visa</option>
              <option value="other">Other</option>
            </select>
            {['work', 'student', 'other'].includes(form.visaType) && (
              <>
                <label className="form-label">Visa Expiry</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.visaExpiry}
                  onChange={e => setForm(f => ({ ...f, visaExpiry: e.target.value }))}
                />
              </>
            )}

            <div className="form-section">Employment</div>
            <select
              className="form-input"
              value={form.employmentType}
              onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}
            >
              <option value="casual">Casual</option>
              <option value="part_time">Part-time</option>
              <option value="full_time">Full-time</option>
            </select>
            <label className="form-label">Start Date</label>
            <input
              className="form-input"
              type="date"
              value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
            />

            {validationError && <p className="form-hint">{validationError}</p>}
            {formError && <p className="form-field-error">{formError}</p>}

            <div className="modal-footer">
              <button type="button" className="modal-btn secondary" onClick={closeForm}>
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn primary"
                onClick={saveStaff}
                disabled={saving}
              >
                {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box staff-delete-modal">
            <div className="modal-title">⚠️ Delete Staff Member?</div>
            <p className="staff-delete-msg">
              Their booking history and financial records will be kept for legal purposes.
              Only their login access will be removed.
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn danger"
                onClick={() => deleteStaff(confirmDelete)}
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
