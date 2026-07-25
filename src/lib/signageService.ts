// Digital Signage — public-safe RPC client (get_signage_data)

import { supabase } from './supabase'

export type SignageRotation = 0 | 90 | 180 | 270

export interface SignageShop {
  id: string
  name: string
  slug: string | null
  themeColor: string
  logoUrl: string | null
  rotation: SignageRotation
  /** Minutes between SIGNAGE_SYNC cache refreshes (from signage_config). */
  refreshIntervalMinutes: number
}

export interface SignageService {
  id: string
  nameEn: string
  nameTh: string | null
  duration: number
  price: number
  category: string
  sortOrder: number
}

export interface SignageAsset {
  id: string
  videoUrl: string
  sortOrder: number
}

export interface SignageData {
  ok: boolean
  error: string | null
  shop: SignageShop | null
  services: SignageService[]
  assets: SignageAsset[]
}

function asRotation(n: unknown): SignageRotation {
  const v = Number(n)
  if (v === 90 || v === 180 || v === 270) return v
  return 0
}

function mapPayload(raw: unknown): SignageData {
  const row = (raw ?? {}) as Record<string, unknown>
  const shopRaw = row.shop as Record<string, unknown> | null
  const servicesRaw = Array.isArray(row.services) ? row.services : []
  const assetsRaw = Array.isArray(row.assets) ? row.assets : []

  return {
    ok: Boolean(row.ok),
    error: typeof row.error === 'string' ? row.error : null,
    shop: shopRaw
      ? {
          id: String(shopRaw.id ?? ''),
          name: String(shopRaw.name ?? ''),
          slug: shopRaw.slug != null ? String(shopRaw.slug) : null,
          themeColor: String(shopRaw.themeColor ?? '#0F6E56'),
          logoUrl: shopRaw.logoUrl != null ? String(shopRaw.logoUrl) : null,
          rotation: asRotation(shopRaw.rotation),
          refreshIntervalMinutes: Math.max(
            1,
            Number(shopRaw.refreshIntervalMinutes) || 360
          ),
        }
      : null,
    services: servicesRaw.map((s) => {
      const r = s as Record<string, unknown>
      return {
        id: String(r.id ?? ''),
        nameEn: String(r.nameEn ?? ''),
        nameTh: r.nameTh != null ? String(r.nameTh) : null,
        duration: Number(r.duration) || 0,
        price: Number(r.price) || 0,
        category: String(r.category ?? 'other'),
        sortOrder: Number(r.sortOrder) || 0,
      }
    }),
    assets: assetsRaw.map((a) => {
      const r = a as Record<string, unknown>
      return {
        id: String(r.id ?? ''),
        videoUrl: String(r.videoUrl ?? ''),
        sortOrder: Number(r.sortOrder) || 0,
      }
    }),
  }
}

/** Public display payload — SECURITY DEFINER RPC only (no direct table SELECT). */
export async function fetchSignageData(shopId: string): Promise<SignageData> {
  const { data, error } = await supabase.rpc('get_signage_data', {
    p_shop_id: shopId,
  })
  if (error) throw new Error(error.message)
  return mapPayload(data)
}
