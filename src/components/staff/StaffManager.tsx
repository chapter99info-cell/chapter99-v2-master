// Chapter99 V4 — Phase 2
// Staff Management (PIN 4444 = add/edit, PIN 9999 = delete)

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

interface StaffManagerProps {
  shopId: string
  pinLevel: 'cashier' | 'owner'
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
  nameEn: '', nameTh: '', role: 'therapist', pin: '',
  commissionRate: 40, baseHourly: 25,
  visaType: '', visaExpiry: '',
  indemnityExpiry: '', liabilityExpiry: '', firstaidExpiry: '',
  employmentType: 'casual', startDate: '',
}

export default function StaffManager({ shopId, pinLevel }: StaffManagerProps) {
  const [staffList, setStaffList] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<StaffForm>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadStaff() }, [shopId])

  async function loadStaff() {
    const { data } = await supabase
      .from('staff')
      .select('*')
      .eq('shop_id', shopId)
      .order('created_at')
    setStaffList(data ?? [])
  }

  function startAdd() {
    setForm(EMPTY_FORM)
    setEditId(null)
    setShowForm(true)
  }

  function startEdit(s: any) {
    setForm({
      nameEn: s.name_en, nameTh: s.name_th ?? '',
      role: s.role, pin: '',
      commissionRate: s.commission_rate * 100,
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
    setShowForm(true)
  }

  async function saveStaff() {
    if (!form.nameEn || !form.pin) return
    setSaving(true)

    const payload: any = {
      shop_id: shopId,
      name_en: form.nameEn,
      name_th: form.nameTh || null,
      role: form.role,
      pin_hash: form.pin,  // triggers hash on DB
      commission_rate: form.commissionRate / 100,
      base_hourly: form.baseHourly,
      visa_type: form.visaType || null,
      visa_expiry: form.visaExpiry || null,
      indemnity_expiry: form.indemnityExpiry || null,
      liability_expiry: form.liabilityExpiry || null,
      firstaid_expiry: form.firstaidExpiry || null,
      employment_type: form.employmentType,
      start_date: form.startDate || null,
      active: true,
    }

    if (editId) {
      await supabase.from('staff').update(payload).eq('id', editId)
    } else {
      await supabase.from('staff').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    loadStaff()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('staff').update({ active }).eq('id', id)
    loadStaff()
  }

  async function deleteStaff(id: string) {
    // Soft delete — keep history for legal/tax
    await supabase.from('staff').update({ active: false, pin_hash: 'DELETED' }).eq('id', id)
    setConfirmDelete(null)
    loadStaff()
  }

  const daysUntil = (dateStr: string) => {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
    return diff
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
        <button className="add-staff-btn" onClick={startAdd}>+ เพิ่มพนักงาน</button>
      </div>

      {/* Staff List */}
      <div className="staff-list">
        {staffList.map(s => {
          const indemnityDays = daysUntil(s.indemnity_expiry)
          const visaDays = daysUntil(s.visa_expiry)

          return (
            <div key={s.id} className={`staff-card${!s.active ? ' inactive' : ''}`}>
              <div className="staff-card-main">
                <div className="staff-avatar">
                  {s.name_en.charAt(0).toUpperCase()}
                </div>
                <div className="staff-info">
                  <div className="staff-name">{s.name_en}</div>
                  <div className="staff-meta">
                    {s.role} · {(s.commission_rate * 100).toFixed(0)}% commission · ${s.base_hourly}/hr
                  </div>
                  {/* Alerts */}
                  <div className="staff-alerts">
                    {indemnityDays !== null && indemnityDays <= 60 && (
                      <span className={`alert-tag ${alertColor(indemnityDays)}`}>
                        🛡 Insurance: {indemnityDays}d
                      </span>
                    )}
                    {visaDays !== null && visaDays <= 90 && (
                      <span className={`alert-tag ${alertColor(visaDays)}`}>
                        🛂 Visa: {visaDays}d
                      </span>
                    )}
                  </div>
                </div>
                <div className="staff-actions">
                  <span className={`staff-status ${s.active ? 'active' : 'inactive'}`}>
                    {s.active ? 'Active' : 'Inactive'}
                  </span>
                  <button className="staff-btn" onClick={() => startEdit(s)}>Edit</button>
                  <button
                    className="staff-btn"
                    onClick={() => toggleActive(s.id, !s.active)}
                  >
                    {s.active ? 'Suspend' : 'Activate'}
                  </button>
                  {pinLevel === 'owner' && (
                    <button
                      className="staff-btn danger"
                      onClick={() => setConfirmDelete(s.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Add/Edit Form Modal */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-title">{editId ? 'Edit Staff' : 'Add Staff'}</div>

            <div className="form-section">Basic Info</div>
            <input className="form-input" placeholder="Name (English) *"
              value={form.nameEn} onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))} />
            <input className="form-input" placeholder="ชื่อ (ไทย)"
              value={form.nameTh} onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))} />

            <select className="form-input" value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="therapist">Therapist</option>
              <option value="cashier">Cashier</option>
              <option value="manager">Manager</option>
            </select>

            <input className="form-input" placeholder="PIN (4 digits) *" maxLength={4}
              type="password" value={form.pin}
              onChange={e => setForm(f => ({ ...f, pin: e.target.value }))} />

            <div className="form-section">Pay Structure</div>
            <div className="form-row">
              <div>
                <label className="form-label">Commission %</label>
                <input className="form-input" type="number" min={0} max={100}
                  value={form.commissionRate}
                  onChange={e => setForm(f => ({ ...f, commissionRate: +e.target.value }))} />
              </div>
              <div>
                <label className="form-label">Base $/hr</label>
                <input className="form-input" type="number"
                  value={form.baseHourly}
                  onChange={e => setForm(f => ({ ...f, baseHourly: +e.target.value }))} />
              </div>
            </div>

            <div className="form-section">Documents & Expiry Dates</div>
            <label className="form-label">Professional Indemnity Insurance</label>
            <input className="form-input" type="date" value={form.indemnityExpiry}
              onChange={e => setForm(f => ({ ...f, indemnityExpiry: e.target.value }))} />
            <label className="form-label">Public Liability Insurance</label>
            <input className="form-input" type="date" value={form.liabilityExpiry}
              onChange={e => setForm(f => ({ ...f, liabilityExpiry: e.target.value }))} />
            <label className="form-label">First Aid Certificate</label>
            <input className="form-input" type="date" value={form.firstaidExpiry}
              onChange={e => setForm(f => ({ ...f, firstaidExpiry: e.target.value }))} />

            <div className="form-section">Visa / Work Rights</div>
            <select className="form-input" value={form.visaType}
              onChange={e => setForm(f => ({ ...f, visaType: e.target.value }))}>
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
                <input className="form-input" type="date" value={form.visaExpiry}
                  onChange={e => setForm(f => ({ ...f, visaExpiry: e.target.value }))} />
              </>
            )}

            <div className="form-section">Employment</div>
            <select className="form-input" value={form.employmentType}
              onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}>
              <option value="casual">Casual</option>
              <option value="part_time">Part-time</option>
              <option value="full_time">Full-time</option>
            </select>
            <label className="form-label">Start Date</label>
            <input className="form-input" type="date" value={form.startDate}
              onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />

            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button
                className="modal-btn primary"
                onClick={saveStaff}
                disabled={!form.nameEn || !form.pin || saving}
              >
                {saving ? 'Saving...' : editId ? 'Save Changes' : 'Add Staff'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-title">⚠️ Delete Staff Member?</div>
            <p style={{ fontSize: 13, color: '#555', margin: '12px 0' }}>
              Their booking history and financial records will be kept for legal purposes.
              Only their login access will be removed.
            </p>
            <div className="modal-footer">
              <button className="modal-btn secondary" onClick={() => setConfirmDelete(null)}>Cancel</button>
              <button className="modal-btn danger" onClick={() => deleteStaff(confirmDelete!)}>
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
