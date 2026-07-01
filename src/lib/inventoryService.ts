// PART 5.3 — Inventory tracking: deduct on POS, low-stock alerts

import { supabase } from './supabase'
import type { BillItem } from '../types/pos'

export interface InventoryItem {
  id: string
  shopId: string
  name: string
  unit: string
  quantity: number
  qtyMin: number | null
  qtyMax: number | null
  reorderThreshold: number
  reorderUrl: string | null
  lastStockTakeDate: string | null
}

export interface ServiceInventoryUsage {
  inventoryItemId: string
  qtyPerUseMin: number
  qtyPerUseMax: number
}

function mapRow(row: Record<string, unknown>): InventoryItem {
  return {
    id: row.id as string,
    shopId: row.shop_id as string,
    name: row.name as string,
    unit: (row.unit as string) || 'unit',
    quantity: Number(row.quantity) || 0,
    qtyMin: row.qty_min != null ? Number(row.qty_min) : null,
    qtyMax: row.qty_max != null ? Number(row.qty_max) : null,
    reorderThreshold: Number(row.reorder_threshold) || 0,
    reorderUrl: (row.reorder_url as string | null) ?? null,
    lastStockTakeDate: (row.last_stock_take_date as string | null) ?? null,
  }
}

function deductQty(min: number, max: number): number {
  if (min >= max) return min
  return Math.round((min + max) / 2 * 100) / 100
}

export async function fetchInventoryItems(shopId: string): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .eq('shop_id', shopId)
    .order('name')

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export async function updateInventoryQuantity(
  itemId: string,
  quantity: number,
  stockTakeDate?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    quantity,
    updated_at: new Date().toISOString(),
  }
  if (stockTakeDate) {
    patch.last_stock_take_date = stockTakeDate
  }
  const { error } = await supabase.from('inventory_items').update(patch).eq('id', itemId)
  if (error) throw new Error(error.message)
}

async function fetchUsageForServices(serviceIds: string[]): Promise<Map<string, ServiceInventoryUsage[]>> {
  if (!serviceIds.length) return new Map()

  const { data, error } = await supabase
    .from('service_inventory_usage')
    .select('service_id, inventory_item_id, qty_per_use_min, qty_per_use_max')
    .in('service_id', serviceIds)

  if (error) throw new Error(error.message)

  const map = new Map<string, ServiceInventoryUsage[]>()
  for (const row of data ?? []) {
    const sid = row.service_id as string
    const list = map.get(sid) ?? []
    list.push({
      inventoryItemId: row.inventory_item_id as string,
      qtyPerUseMin: Number(row.qty_per_use_min) || 1,
      qtyPerUseMax: Number(row.qty_per_use_max) || 1,
    })
    map.set(sid, list)
  }
  return map
}

/** Deduct inventory linked to services sold on a POS bill. */
export async function deductInventoryForSale(
  shopId: string,
  items: BillItem[]
): Promise<void> {
  const serviceIds = items
    .map(i => i.serviceId)
    .filter(id => id && !id.startsWith('voucher-') && !id.startsWith('addon-'))

  if (!serviceIds.length) return

  const usageMap = await fetchUsageForServices(serviceIds)
  const deductions = new Map<string, number>()

  for (const item of items) {
    const usages = usageMap.get(item.serviceId)
    if (!usages?.length) continue
    for (const u of usages) {
      const qty = deductQty(u.qtyPerUseMin, u.qtyPerUseMax)
      deductions.set(
        u.inventoryItemId,
        (deductions.get(u.inventoryItemId) ?? 0) + qty
      )
    }
  }

  if (!deductions.size) return

  const { data: invItems } = await supabase
    .from('inventory_items')
    .select('id, name, quantity, reorder_threshold')
    .eq('shop_id', shopId)
    .in('id', [...deductions.keys()])

  for (const inv of invItems ?? []) {
    const deduct = deductions.get(inv.id as string) ?? 0
    if (deduct <= 0) continue
    const nextQty = Math.max(0, Number(inv.quantity) - deduct)
    await supabase
      .from('inventory_items')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('id', inv.id)

    const threshold = Number(inv.reorder_threshold) || 0
    if (threshold > 0 && nextQty <= threshold) {
      await fireLowInventoryAlert(shopId, inv.id as string, inv.name as string, nextQty, threshold)
    }
  }
}

async function fireLowInventoryAlert(
  shopId: string,
  itemId: string,
  itemName: string,
  quantity: number,
  threshold: number
): Promise<void> {
  const alertId = `low-inventory-${shopId}-${itemId}`
  await supabase.from('alerts').upsert(
    {
      id: alertId,
      shop_id: shopId,
      type: 'low_inventory',
      severity: quantity <= threshold * 0.5 ? 'critical' : 'warning',
      title: `Low stock — ${itemName}`,
      message: `${itemName}: ${quantity} remaining (reorder at ${threshold})`,
      dismissed: false,
      created_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  )
}

export async function checkInventoryAlerts(shopId: string): Promise<
  { id: string; title: string; message: string; severity: string }[]
> {
  const items = await fetchInventoryItems(shopId)
  return items
    .filter(i => i.reorderThreshold > 0 && i.quantity <= i.reorderThreshold)
    .map(i => ({
      id: `low-inventory-${shopId}-${i.id}`,
      title: `Low stock — ${i.name}`,
      message: `${i.name}: ${i.quantity} ${i.unit} remaining (reorder at ${i.reorderThreshold})`,
      severity: i.quantity <= i.reorderThreshold * 0.5 ? 'critical' : 'warning',
    }))
}
