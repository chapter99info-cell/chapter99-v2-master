import { useCallback, useEffect, useState } from 'react'
import {
  fetchInventoryItems,
  updateInventoryQuantity,
  type InventoryItem,
} from '../../lib/inventoryService'

interface InventoryManagerProps {
  shopId: string
}

export default function InventoryManager({ shopId }: InventoryManagerProps) {
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [stockTake, setStockTake] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const rows = await fetchInventoryItems(shopId)
      setItems(rows)
      const initial: Record<string, string> = {}
      for (const r of rows) {
        initial[r.id] = String(r.quantity)
      }
      setStockTake(initial)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load inventory')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  useEffect(() => {
    void load()
  }, [load])

  const handleStockTake = async (item: InventoryItem) => {
    const raw = stockTake[item.id]
    const qty = parseFloat(raw)
    if (Number.isNaN(qty) || qty < 0) return
    setSavingId(item.id)
    try {
      await updateInventoryQuantity(item.id, qty, new Date().toISOString().slice(0, 10))
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) return <p className="reports-muted">Loading inventory…</p>
  if (error) return <p className="reports-error">{error}</p>

  return (
    <div className="inventory-manager">
      <header className="inv-header">
        <h2>Inventory / สต็อกสินค้า</h2>
        <p className="reports-muted">
          System quantity auto-deducts on POS sales. Use stock take to record physical counts.
        </p>
      </header>

      {items.length === 0 ? (
        <p className="reports-muted">No inventory items configured for this shop.</p>
      ) : (
        <div className="reports-table-wrap">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Item</th>
                <th>System qty</th>
                <th>Stock take</th>
                <th>Variance</th>
                <th>Reorder at</th>
                <th>Last stock take</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const takeVal = parseFloat(stockTake[item.id] ?? '')
                const variance =
                  !Number.isNaN(takeVal) ? Math.round((takeVal - item.quantity) * 100) / 100 : null
                const low =
                  item.reorderThreshold > 0 && item.quantity <= item.reorderThreshold
                return (
                  <tr key={item.id} className={low ? 'inv-row-low' : undefined}>
                    <td>
                      {item.name}
                      <span className="reports-muted"> ({item.unit})</span>
                    </td>
                    <td>{item.quantity}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        className="inv-qty-input"
                        value={stockTake[item.id] ?? ''}
                        onChange={e =>
                          setStockTake(prev => ({ ...prev, [item.id]: e.target.value }))
                        }
                      />
                    </td>
                    <td className={variance !== null && variance !== 0 ? 'inv-variance' : ''}>
                      {variance === null ? '—' : variance > 0 ? `+${variance}` : String(variance)}
                    </td>
                    <td>{item.reorderThreshold}</td>
                    <td>{item.lastStockTakeDate ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="reports-export-btn secondary"
                        disabled={savingId === item.id}
                        onClick={() => void handleStockTake(item)}
                      >
                        {savingId === item.id ? 'Saving…' : 'Save'}
                      </button>
                      {item.reorderUrl && low && (
                        <a
                          href={item.reorderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inv-reorder-link"
                        >
                          Reorder
                        </a>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
