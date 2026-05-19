// Chapter99 V4 — Services CRUD (owner)

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import type { Service } from '../../types/pos'
import './ServicesManager.css'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
)

const SHOP_ID = import.meta.env.VITE_SHOP_ID ?? 'shop-001'

const CATEGORIES = ['thai', 'remedial', 'aroma', 'deep_tissue', 'other'] as const
type ServiceCategory = (typeof CATEGORIES)[number]

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
  category: ServiceCategory
  sortOrder: number
}

const EMPTY_FORM: ServiceForm = {
  nameEn: '',
  nameTh: '',
  duration: 60,
  price: 80,
  gstFree: false,
  itemNo: '',
  category: 'thai',
  sortOrder: 0,
}

export function mapRowToService(row: ServiceRow): Service {
  const category = CATEGORIES.includes(row.category as ServiceCategory)
    ? (row.category as ServiceCategory)
    : 'other'
  return {
    id: row.id,
    name: row.name_en,
    nameEn: row.name_en,
    duration: row.duration,
    price: Number(row.price),
    gstFree: row.gst_free,
    itemNo: row.item_no ?? undefined,
    category,
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
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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
      category: CATEGORIES.includes(row.category as ServiceCategory)
        ? (row.category as ServiceCategory)
        : 'other',
      sortOrder: row.sort_order ?? 0,
    })
    setEditId(row.id)
    setShowForm(true)
  }

  async function saveService() {
    if (!form.nameEn.trim()) return
    setSaving(true)
    setError('')

    const payload = {
      name_en: form.nameEn.trim(),
      name_th: form.nameTh.trim() || null,
      duration: form.duration,
      price: form.price,
      gst_free: form.gstFree,
      item_no: form.itemNo.trim() || null,
      category: form.category,
      sort_order: form.sortOrder,
    }

    const result = editId
      ? await supabase.from('services').update(payload).eq('id', editId).eq('shop_id', shopId)
      : await supabase.from('services').insert({ ...payload, shop_id: shopId, active: true })

    if (result.error) {
      setError(result.error.message)
    } else {
      setShowForm(false)
      await loadServices()
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

    if (updateError) setError(updateError.message)
    else loadServices()
  }

  async function deleteService(id: string) {
    setError('')
    const { error: deleteError } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('shop_id', shopId)

    if (deleteError) setError(deleteError.message)
    else {
      setConfirmDelete(null)
      loadServices()
    }
  }

  const categoryLabel = (c: string) =>
    c.replace('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase())

  return (
    <div className="services-manager">
      <div className="services-header">
        <h2 className="services-title">Services</h2>
        <button type="button" className="add-service-btn" onClick={startAdd}>
          + Add service
        </button>
      </div>

      {error && <div className="services-error">{error}</div>}
      {loading && <div className="services-loading">Loading services…</div>}

      {!loading && (
        <div className="services-list">
          {services.length === 0 && (
            <p className="services-empty">No services yet. Add your first service.</p>
          )}
          {services.map(row => (
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
                    onClick={() => setConfirmDelete(row.id)}
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
              className="form-input"
              placeholder="Name (English) *"
              value={form.nameEn}
              onChange={e => setForm(f => ({ ...f, nameEn: e.target.value }))}
            />
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
                <label className="form-label">Price (AUD)</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.price}
                  onChange={e =>
                    setForm(f => ({ ...f, price: +e.target.value || 0 }))
                  }
                />
              </div>
            </div>

            <select
              className="form-input"
              value={form.category}
              onChange={e =>
                setForm(f => ({
                  ...f,
                  category: e.target.value as ServiceCategory,
                }))
              }
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>

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
                disabled={!form.nameEn.trim() || form.duration < 1 || saving}
              >
                {saving ? 'Saving…' : editId ? 'Save changes' : 'Add service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400 }}>
            <div className="modal-title">Delete service?</div>
            <p className="services-delete-msg">
              This permanently removes the service from your menu. Past transactions
              are not affected.
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
                onClick={() => deleteService(confirmDelete)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
