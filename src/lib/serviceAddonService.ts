import { supabase } from './supabase'
import type { ServiceAddon, ServiceAddonRow } from '../types/serviceAddon'

function mapRow(row: ServiceAddonRow): ServiceAddon {
  return {
    id: row.id,
    shopId: row.shop_id,
    name: row.name,
    price: Number(row.price),
    active: row.active,
    createdAt: row.created_at,
  }
}

export async function fetchServiceAddons(
  shopId: string,
  options?: { activeOnly?: boolean }
): Promise<ServiceAddon[]> {
  let query = supabase
    .from('service_addons')
    .select('id, shop_id, name, price, active, created_at')
    .eq('shop_id', shopId)
    .order('name', { ascending: true })

  if (options?.activeOnly) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data ?? []).map(row => mapRow(row as ServiceAddonRow))
}

export async function createServiceAddon(
  shopId: string,
  name: string,
  price: number
): Promise<{ addon?: ServiceAddon; error?: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Name is required' }
  if (!Number.isFinite(price) || price < 0) return { error: 'Price must be zero or greater' }

  const { data, error } = await supabase
    .from('service_addons')
    .insert({
      shop_id: shopId,
      name: trimmed,
      price,
      active: true,
    })
    .select('id, shop_id, name, price, active, created_at')
    .single()

  if (error) return { error: error.message }
  return { addon: mapRow(data as ServiceAddonRow) }
}

export async function setServiceAddonActive(
  id: string,
  active: boolean
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('service_addons')
    .update({ active })
    .eq('id', id)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function deleteServiceAddon(
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase.from('service_addons').delete().eq('id', id)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Bill line id for a POS add-on row */
export function addonBillItemId(addonId: string): string {
  return `addon-${addonId}`
}

export function isAddonBillItem(serviceId: string): boolean {
  return serviceId.startsWith('addon-')
}
