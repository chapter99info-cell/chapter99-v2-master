// Chapter99 V4 — Services CRUD (owner)

import { useState, useEffect } from 'react'
import type { Service } from '../../types/pos'
import { supabase, SHOP_ID } from '../../lib/supabase'
import Toast, { type ToastType } from '../ui/Toast'
import './ServicesManager.css'

interface ServiceRow {
  id: string
  shop_id: string
  name_en: string
  name_th: string | null
  duration: number
  price: number
  gst_free: boolean
  item_no: string | null
  category: string
  active: boolean
  sort_order: number
}

interface ServiceForm {
  nameEn: string
  nameTh: string
  duration: number
  price: number
  gstFree: boolean
  itemNo: string
  category: string
  sortOrder: number
}

const EMPTY_FORM: ServiceForm = {
  nameEn: '',
  nameTh: '',
  duration: 60,
  price: 80,
  gstFree: false,
  itemNo: '',
  category: '',
  sortOrder: 0,
}

export function mapRowToService(row: ServiceRow): Service {
  return {
    id: row.id,
    name: row.name_en,
    nameEn: row.name_en,
    duration: row.duration,
    price: Number(row.price),
    gstFree: row.gst_free,
    itemNo: row.item_no ?? undefined,
    category: row.category || 'other',
  }
}

interface ServicesManagerProps {
  shopId?: string
}

export default function ServicesManager({ shopId = SHOP_ID }: ServicesManagerProps) {
  const [services, setServices] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<ServiceForm>(EMPTY_FORM)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [formErrors, setFormErrors] = useState<{ nameEn?: string; price?: string }>({})
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  useEffect(() => {
    loadServices()
  }, [shopId])

  async function loadServices() {
    setLoading(true)
    setError('')
    const { data, error: loadError } = await supabase
      .from('services')
      .select('*')
      .eq('shop_id', shopId)
      .order('sort_order', { ascending: true })
      .order('name_en', { ascending: true })

    if (loadError) {
      setError(loadError.message)
      setServices([])
    } else {
      setServices((data as ServiceRow[]) ?? [])
    }
    setLoading(false)
  }

  function startAdd() {
    const nextOrder =
      services.length > 0
        ? Math.max(...services.map(s => s.sort_order ?? 0)) + 1
        : 0
    setForm({ ...EMPTY_FORM, sortOrder: nextOrder })
    setEditId(null)
    setShowForm(true)
  }

  function startEdit(row: ServiceRow) {
    setForm({
      nameEn: row.name_en,
      nameTh: row.name_th ?? '',
      duration: row.duration,
      price: Number(row.price),
      gstFree: row.gst_free,
      itemNo: row.item_no ?? '',
      category: row.category ?? '',
      sortOrder: row.sort_order ?? 0,
    })
    setEditId(row.id)
    setShowForm(true)
  }

  function validateForm(): boolean {
    const errors: { nameEn?: string; price?: string } = {}
    if (!form.nameEn.trim()) errors.nameEn = 'English name is required'
    if (form.price === undefined || form.price === null || Number.isNaN(form.price)) {
      errors.price = 'Price is required'
    } else if (form.price < 0) {
      errors.price = 'Price must be 0 or greater'
    }
    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function saveService() {
    if (!validateForm()) return
    setSaving(true)
    setError('')

    const payload = {
      name_en: form.nameEn.trim(),
      name_th: form.nameTh.trim() || null,
      duration: form.duration,
      price: form.price,
      gst_free: form.gstFree,
      item_no: form.itemNo.trim() || null,
      category: form.category.trim() || 'other',
      sort_order: form.sortOrder,
    }

    const result = editId
      ? await supabase.from('services').update(payload).eq('id', editId).eq('shop_id', shopId)
      : await supabase.from('services').insert({ ...payload, shop_id: shopId, active: true })

    if (result.error) {
      setError(result.error.message)
      setToast({ message: result.error.message, type: 'error' })
    } else {
      setShowForm(false)
      setFormErrors({})
      await loadServices()
      setToast({
        message: editId ? 'Service updated' : 'Service added',
        type: 'success',
      })
    }
    setSaving(false)
  }

  async function toggleActive(id: string, active: boolean) {
    setError('')
    const { error: updateError } = await supabase
      .from('services')
      .update({ active })
      .eq('id', id)
      .eq('shop_id', shopId)

    if (updateError) {
      setError(updateError.message)
      setToast({ message: updateError.message, type: 'error' })
    } else {
      loadServices()
      setToast({
        message: active ? 'Service is now visible on POS' : 'Service hidden from POS',
        type: 'success',
      })
    }
  }

  function requestDeleteService(id: string) {
    setShowForm(false)
    setEditId(null)
    setConfirmDelete(id)
  }

  async function deleteService() {
    const id = confirmDelete
    if (!id) return

    setDeleting(true)
    setError('')

    try {
      const { data: deleted, error: deleteError } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
        .eq('shop_id', shopId)
        .select('id')

      if (!deleteError && deleted?.length) {
        setConfirmDelete(null)
        setToast({ message: 'Service deleted', type: 'success' })
        await loadServices()
        return
      }

      const { data: hidden, error: hideError } = await supabase
        .from('services')
        .update({ active: false })
        .eq('id', id)
        .eq('shop_id', shopId)
        .select('id')

      if (!hideError && hidden?.length) {
        setConfirmDelete(null)
        setToast({
          message: 'Service removed from menu (linked history kept)',
          type: 'success',
        })
        await loadServices()
        return
      }

      const msg =
        hideError?.message ??
        deleteError?.message ??
        'Could not delete service — run supabase/36-services-manager-rls.sql in Supabase SQL Editor'
      setError(msg)
      setToast({ message: msg, type: 'error' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Delete failed'
      setError(msg)
      setToast({ message: msg, type: 'error' })
    } finally {
      setDeleting(false)
    }
  }

  const filteredServices = services.filter(row => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return true
    return (
      row.name_en.toLowerCase().includes(q) ||
      (row.name_th?.toLowerCase().includes(q) ?? false) ||
      row.category.toLowerCase().includes(q)
    )
  })

  const deleteTarget = confirmDelete
    ? services.find(s => s.id === confirmDelete)
    : null

  const categoryLabel = (c: string) =>
    c.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())

  return (
    <div className="services-manager">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      <div className="services-header">
        <h2 className="services-title">Services</h2>
        <button type="button" className="add-service-btn" onClick={startAdd}>
          + Add service
        </button>
      </div>

      <input
        type="search"
        className="services-search"
        placeholder="Search by name or category…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
      />

      {error && <div className="services-error">{error}</div>}
      {loading && <div className="services-loading">Loading services…</div>}

      {!loading && (
        <div className="services-list">
          {services.length === 0 && (
            <p className="services-empty">No services yet. Add your first service.</p>
          )}
          {services.length > 0 && filteredServices.length === 0 && (
            <p className="services-empty">No services match your search.</p>
          )}
          {filteredServices.map(row => (
            <div
              key={row.id}
              className={`service-card${row.active ? '' : ' inactive'}`}
            >
              <div className="service-card-main">
                <div className="service-info">
                  <div className="service-name">{row.name_en}</div>
                  {row.name_th && (
                    <div className="service-name-th">{row.name_th}</div>
                  )}
                  <div className="service-meta">
                    {categoryLabel(row.category)} · {row.duration} min · $
                    {Number(row.price).toFixed(2)}
                    {row.gst_free && ' · GST-free'}
                    {row.item_no && ` · Item ${row.item_no}`}
                    {' · Sort '}
                    {row.sort_order}
                  </div>
                </div>
                <div className="service-actions">
                  <span
                    className={`service-status ${row.active ? 'active' : 'inactive'}`}
                  >
                    {row.active ? 'Visible' : 'Hidden'}
                  </span>
                  <button
                    type="button"
                    className="service-btn"
                    onClick={() => startEdit(row)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="service-btn"
                    onClick={() => toggleActive(row.id, !row.active)}
                  >
                    {row.active ? 'Hide' : 'Show'}
                  </button>
                  <button
                    type="button"
                    className="service-btn danger"
                    onClick={() => requestDeleteService(row.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-box services-modal">
            <div className="modal-title">
              {editId ? 'Edit service' : 'Add service'}
            </div>

            <input
              className={`form-input${formErrors.nameEn ? ' invalid' : ''}`}
              placeholder="Name (English) *"
              value={form.nameEn}
              onChange={e => {
                setForm(f => ({ ...f, nameEn: e.target.value }))
                if (formErrors.nameEn) setFormErrors(e => ({ ...e, nameEn: undefined }))
              }}
            />
            {formErrors.nameEn && (
              <p className="form-field-error">{formErrors.nameEn}</p>
            )}
            <input
              className="form-input"
              placeholder="ชื่อ (ไทย)"
              value={form.nameTh}
              onChange={e => setForm(f => ({ ...f, nameTh: e.target.value }))}
            />

            <div className="form-row">
              <div>
                <label className="form-label">Duration (min)</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={form.duration}
                  onChange={e =>
                    setForm(f => ({ ...f, duration: +e.target.value || 0 }))
                  }
                />
              </div>
              <div>
                <label className="form-label">Price (AUD) *</label>
                <input
                  className={`form-input${formErrors.price ? ' invalid' : ''}`}
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={e => {
                    setForm(f => ({ ...f, price: +e.target.value || 0 }))
                    if (formErrors.price) setFormErrors(e => ({ ...e, price: undefined }))
                  }}
                />
                {formErrors.price && (
                  <p className="form-field-error">{formErrors.price}</p>
                )}
              </div>
            </div>

            <label className="form-label">Category</label>
            <input
              className="form-input"
              placeholder="e.g. thai, remedial, hot stone"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
            />

            <input
              className="form-input"
              placeholder="Health fund item no (optional)"
              value={form.itemNo}
              onChange={e => setForm(f => ({ ...f, itemNo: e.target.value }))}
            />

            <label className="form-label">Sort order</label>
            <input
              className="form-input"
              type="number"
              value={form.sortOrder}
              onChange={e =>
                setForm(f => ({ ...f, sortOrder: +e.target.value || 0 }))
              }
            />
            <p className="form-hint">
              ลำดับการแสดงในหน้า POS — เลขน้อยแสดงก่อน (เช่น 0, 1, 2...)
            </p>

            <label className="form-checkbox">
              <input
                type="checkbox"
                checked={form.gstFree}
                onChange={e =>
                  setForm(f => ({ ...f, gstFree: e.target.checked }))
                }
              />
              GST-free (e.g. remedial massage)
            </label>

            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn primary"
                onClick={saveService}
                disabled={form.duration < 1 || saving}
              >
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Add service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          className="modal-overlay modal-overlay--portal"
          role="presentation"
          onClick={() => {
            if (!deleting) setConfirmDelete(null)
          }}
        >
          <div
            className="modal-box"
            role="dialog"
            aria-modal="true"
            aria-labelledby="service-delete-title"
            style={{ maxWidth: 400 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-title" id="service-delete-title">
              Remove service from menu?
            </div>
            <p className="services-delete-msg">
              {deleteTarget ? (
                <>
                  Remove <strong>{deleteTarget.name_en}</strong> from POS and online booking?
                  Existing bookings and transactions are kept when removal is blocked by linked
                  records.
                </>
              ) : (
                'Remove this service from POS and online booking?'
              )}
            </p>
            <div className="modal-footer">
              <button
                type="button"
                className="modal-btn secondary"
                disabled={deleting}
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="modal-btn danger"
                disabled={deleting}
                onClick={() => void deleteService()}
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
