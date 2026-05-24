import { useEffect, useState } from 'react'
import { formatAUD } from '../../lib/posCalc'
import { supabase } from '../../lib/supabase'
import Toast, { type ToastType } from '../ui/Toast'

interface ServiceAddonRow {
  id: string
  shop_id: string
  name: string
  price: number
  active: boolean
  created_at?: string
}

interface ServiceAddonsSectionProps {
  shopId: string
}

/** Owner Settings — POS service add-ons (always rendered above Save settings). */
export default function ServiceAddonsSection({ shopId }: ServiceAddonsSectionProps) {
  const [addons, setAddons] = useState<ServiceAddonRow[]>([])
  const [newAddonName, setNewAddonName] = useState('')
  const [newAddonPrice, setNewAddonPrice] = useState('')
  const [addonLoading, setAddonLoading] = useState(false)
  const [addonSaving, setAddonSaving] = useState(false)
  const [fetchError, setFetchError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<ServiceAddonRow | null>(null)
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null)

  async function loadAddons() {
    setAddonLoading(true)
    setFetchError('')
    const { data, error } = await supabase
      .from('service_addons')
      .select('id, shop_id, name, price, active, created_at')
      .eq('shop_id', shopId)
      .order('created_at', { ascending: true })

    if (error) {
      setFetchError(
        error.message.includes('service_addons')
          ? `${error.message} — run supabase/35-service-addons.sql in Supabase SQL Editor.`
          : error.message
      )
      setAddons([])
    } else {
      setAddons(
        (data ?? []).map(row => ({
          ...row,
          price: Number(row.price),
        })) as ServiceAddonRow[]
      )
    }
    setAddonLoading(false)
  }

  useEffect(() => {
    void loadAddons()
  }, [shopId])

  async function handleAdd() {
    const parsedPrice = parseFloat(newAddonPrice)
    if (!newAddonName.trim()) {
      setToast({ message: 'Enter an add-on name', type: 'error' })
      return
    }
    if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
      setToast({ message: 'Enter a valid price', type: 'error' })
      return
    }

    setAddonSaving(true)
    const { error } = await supabase.from('service_addons').insert({
      shop_id: shopId,
      name: newAddonName.trim(),
      price: parsedPrice,
      active: true,
    })
    setAddonSaving(false)

    if (error) {
      setToast({ message: error.message, type: 'error' })
      return
    }

    setNewAddonName('')
    setNewAddonPrice('')
    setToast({ message: 'Add-on added', type: 'success' })
    await loadAddons()
  }

  async function handleToggleActive(addon: ServiceAddonRow) {
    const { data, error } = await supabase
      .from('service_addons')
      .update({ active: !addon.active })
      .eq('id', addon.id)
      .eq('shop_id', shopId)
      .select('id')

    if (error || !data?.length) {
      setToast({
        message: error?.message ?? 'Could not update add-on',
        type: 'error',
      })
      return
    }
    await loadAddons()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    const { error } = await supabase
      .from('service_addons')
      .delete()
      .eq('id', deleteTarget.id)
      .eq('shop_id', shopId)

    setDeleteTarget(null)

    if (error) {
      setToast({ message: error.message, type: 'error' })
      return
    }

    setAddons(prev => prev.filter(a => a.id !== deleteTarget.id))
    setToast({ message: 'Add-on deleted', type: 'success' })
  }

  return (
    <>
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <section
        className="ss-section ss-section-addons"
        id="owner-addons-section"
        data-testid="service-addons-section"
      >
        <h2 className="ss-section-title">Service Add-ons</h2>
        <p className="ss-hint" style={{ marginBottom: 12 }}>
          Optional POS extras (e.g. Coconut Oil +$10). Active add-ons appear on the POS bill after a
          service is selected.
        </p>

        {fetchError && <p className="ss-error">{fetchError}</p>}

        <div className="ss-addon-form ss-row">
          <div className="ss-field">
            <label htmlFor="ss-addon-name">Name</label>
            <input
              id="ss-addon-name"
              className="ss-input"
              type="text"
              placeholder="Coconut Oil"
              value={newAddonName}
              onChange={e => setNewAddonName(e.target.value)}
            />
          </div>
          <div className="ss-field">
            <label htmlFor="ss-addon-price">Price ($)</label>
            <input
              id="ss-addon-price"
              className="ss-input"
              type="number"
              min="0"
              step="0.01"
              placeholder="10.00"
              value={newAddonPrice}
              onChange={e => setNewAddonPrice(e.target.value)}
            />
          </div>
        </div>
        <button
          type="button"
          className="ss-btn primary"
          disabled={addonSaving || addonLoading}
          onClick={() => void handleAdd()}
        >
          {addonSaving ? 'Adding…' : 'Add'}
        </button>

        {addonLoading ? (
          <p className="ss-hint" style={{ marginTop: 16 }}>Loading add-ons…</p>
        ) : addons.length === 0 ? (
          <p className="ss-hint" style={{ marginTop: 16 }}>No add-ons yet.</p>
        ) : (
          <ul className="ss-addon-list">
            {addons.map(addon => (
              <li key={addon.id} className={`ss-addon-row${addon.active ? '' : ' inactive'}`}>
                <div>
                  <div className="ss-addon-name">{addon.name}</div>
                  <div className="ss-addon-price">{formatAUD(addon.price)}</div>
                </div>
                <div className="ss-addon-actions">
                  <label className="ss-checkbox">
                    <input
                      type="checkbox"
                      checked={addon.active}
                      onChange={() => void handleToggleActive(addon)}
                    />
                    Active
                  </label>
                  <button
                    type="button"
                    className="ss-btn secondary ss-addon-delete"
                    onClick={() => setDeleteTarget(addon)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {deleteTarget && (
        <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div
            className="modal-box"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: 400 }}
          >
            <div className="modal-title">Delete add-on?</div>
            <p className="ss-hint">
              Remove <strong>{deleteTarget.name}</strong>? This cannot be undone.
            </p>
            <div className="ss-actions" style={{ marginTop: 16 }}>
              <button
                type="button"
                className="ss-btn secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="ss-btn primary"
                style={{ background: 'var(--color-danger-dark, #b42318)' }}
                onClick={() => void handleDelete()}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
