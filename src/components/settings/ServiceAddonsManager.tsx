import { useCallback, useEffect, useState } from 'react'
import { formatAUD } from '../../lib/posCalc'
import {
  createServiceAddon,
  deleteServiceAddon,
  fetchServiceAddons,
  setServiceAddonActive,
} from '../../lib/serviceAddonService'
import { SHOP_ID } from '../../lib/supabase'
import type { ServiceAddon } from '../../types/serviceAddon'
import Toast, { type ToastType } from '../ui/Toast'
import './ServiceAddonsManager.css'

interface ServiceAddonsManagerProps {
  shopId?: string
}

export default function ServiceAddonsManager({ shopId = SHOP_ID }: ServiceAddonsManagerProps) {
  const [addons, setAddons] = useState<ServiceAddon[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ServiceAddon | null>(null)

  const loadAddons = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setAddons(await fetchServiceAddons(shopId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load add-ons')
      setAddons([])
    }
    setLoading(false)
  }, [shopId])

  useEffect(() => {
    void loadAddons()
  }, [loadAddons])

  async function handleSave() {
    const parsedPrice = parseFloat(price)
    if (!name.trim()) {
      setToast({ message: 'Enter an add-on name', type: 'error' })
      return
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setToast({ message: 'Enter a valid price', type: 'error' })
      return
    }

    setSaving(true)
    const result = await createServiceAddon(shopId, name, parsedPrice)
    setSaving(false)

    if (result.error) {
      setToast({ message: result.error, type: 'error' })
      return
    }

    setName('')
    setPrice('')
    setToast({ message: 'Add-on saved', type: 'success' })
    await loadAddons()
  }

  async function handleToggleActive(addon: ServiceAddon) {
    const result = await setServiceAddonActive(addon.id, !addon.active)
    if (!result.ok) {
      setToast({ message: result.error ?? 'Update failed', type: 'error' })
      return
    }
    await loadAddons()
  }

  async function handleDelete() {
    if (!confirmDelete) return
    const result = await deleteServiceAddon(confirmDelete.id)
    setConfirmDelete(null)
    if (!result.ok) {
      setToast({ message: result.error ?? 'Delete failed', type: 'error' })
      return
    }
    setToast({ message: 'Add-on deleted', type: 'success' })
    await loadAddons()
  }

  return (
    <div className="service-addons-manager">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <p className="sam-hint">
        Optional extras for POS (e.g. Coconut Oil +$10). Active add-ons appear as toggle chips
        after a service is added to the bill.
      </p>

      {error && <p className="sam-error">{error}</p>}

      <div className="sam-form">
        <div className="sam-field">
          <label htmlFor="addon-name">Name</label>
          <input
            id="addon-name"
            type="text"
            placeholder="Coconut Oil"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div className="sam-field sam-field-price">
          <label htmlFor="addon-price">Price ($)</label>
          <input
            id="addon-price"
            type="number"
            min="0"
            step="0.01"
            placeholder="10.00"
            value={price}
            onChange={e => setPrice(e.target.value)}
          />
        </div>
        <button
          type="button"
          className="sam-save-btn"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      {loading ? (
        <p className="sam-hint">Loading add-ons…</p>
      ) : addons.length === 0 ? (
        <p className="sam-empty">No add-ons yet. Add your first extra above.</p>
      ) : (
        <ul className="sam-list">
          {addons.map(addon => (
            <li key={addon.id} className={`sam-row${addon.active ? '' : ' inactive'}`}>
              <div className="sam-row-main">
                <span className="sam-row-name">{addon.name}</span>
                <span className="sam-row-price">{formatAUD(addon.price)}</span>
              </div>
              <div className="sam-row-actions">
                <label className="sam-toggle">
                  <input
                    type="checkbox"
                    checked={addon.active}
                    onChange={() => void handleToggleActive(addon)}
                  />
                  <span>{addon.active ? 'Active' : 'Inactive'}</span>
                </label>
                <button
                  type="button"
                  className="sam-delete-btn"
                  onClick={() => setConfirmDelete(addon)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal-box sam-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-title">Delete add-on?</div>
            <p className="sam-hint">
              Remove <strong>{confirmDelete.name}</strong>? This cannot be undone.
            </p>
            <div className="sam-modal-actions">
              <button type="button" className="sam-cancel-btn" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="button" className="sam-delete-confirm-btn" onClick={() => void handleDelete()}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
