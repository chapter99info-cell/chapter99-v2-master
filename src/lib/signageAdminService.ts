// Signage admin — PIN-gated RPC clients (verify_pin via SECURITY DEFINER)

import { supabase } from './supabase'
import type { SignageRotation } from './signageService'

export interface SignageAdminAsset {
  id: string
  videoUrl: string
  sortOrder: number
  active: boolean
  createdAt?: string
}

export interface SignageAdminConfig {
  rotation: SignageRotation
  refreshIntervalMinutes: number
}

function asRotation(n: unknown): SignageRotation {
  const v = Number(n)
  if (v === 90 || v === 180 || v === 270) return v
  return 0
}

export async function adminListSignage(
  shopId: string,
  pin: string
): Promise<{
  ok: boolean
  error?: string
  assets: SignageAdminAsset[]
  config: SignageAdminConfig
}> {
  const { data, error } = await supabase.rpc('admin_list_signage_assets', {
    p_shop_id: shopId,
    p_pin: pin,
  })
  if (error) return { ok: false, error: error.message, assets: [], config: { rotation: 0, refreshIntervalMinutes: 360 } }
  const row = (data ?? {}) as Record<string, unknown>
  if (!row.ok) {
    return {
      ok: false,
      error: String(row.error ?? 'Denied'),
      assets: [],
      config: { rotation: 0, refreshIntervalMinutes: 360 },
    }
  }
  const assetsRaw = Array.isArray(row.assets) ? row.assets : []
  const cfg = (row.config ?? {}) as Record<string, unknown>
  return {
    ok: true,
    assets: assetsRaw.map((a) => {
      const r = a as Record<string, unknown>
      return {
        id: String(r.id ?? ''),
        videoUrl: String(r.videoUrl ?? ''),
        sortOrder: Number(r.sortOrder) || 0,
        active: Boolean(r.active),
        createdAt: r.createdAt != null ? String(r.createdAt) : undefined,
      }
    }),
    config: {
      rotation: asRotation(cfg.rotation),
      refreshIntervalMinutes: Math.max(1, Number(cfg.refreshIntervalMinutes) || 360),
    },
  }
}

export async function adminUpsertSignageAsset(
  shopId: string,
  pin: string,
  input: {
    videoUrl: string
    sortOrder?: number
    active?: boolean
    id?: string
  }
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_upsert_signage_asset', {
    p_shop_id: shopId,
    p_pin: pin,
    p_video_url: input.videoUrl,
    p_sort_order: input.sortOrder ?? 0,
    p_active: input.active ?? true,
    p_id: input.id ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const row = (data ?? {}) as Record<string, unknown>
  if (!row.ok) return { ok: false, error: String(row.error ?? 'Upsert failed') }
  return { ok: true }
}

export async function adminDeleteSignageAsset(
  shopId: string,
  pin: string,
  id: string
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_delete_signage_asset', {
    p_shop_id: shopId,
    p_pin: pin,
    p_id: id,
  })
  if (error) return { ok: false, error: error.message }
  const row = (data ?? {}) as Record<string, unknown>
  if (!row.ok) return { ok: false, error: String(row.error ?? 'Delete failed') }
  return { ok: true }
}

export async function adminUpdateSignageConfig(
  shopId: string,
  pin: string,
  patch: { rotation?: SignageRotation; refreshIntervalMinutes?: number }
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase.rpc('admin_update_signage_config', {
    p_shop_id: shopId,
    p_pin: pin,
    p_rotation: patch.rotation ?? null,
    p_refresh_interval_minutes: patch.refreshIntervalMinutes ?? null,
  })
  if (error) return { ok: false, error: error.message }
  const row = (data ?? {}) as Record<string, unknown>
  if (!row.ok) return { ok: false, error: String(row.error ?? 'Config update failed') }
  return { ok: true }
}

/** Upload a clip into shop-assets; returns public URL. */
export async function uploadSignageClip(
  shopId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  const isVideo = file.type.startsWith('video/')
  const rawExt = (file.name.split('.').pop() || (isVideo ? 'mp4' : 'bin')).toLowerCase()
  const ext = rawExt.replace(/[^a-z0-9]/g, '') || 'mp4'
  const path = `shops/${shopId}/signage-${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('shop-assets').upload(path, file, {
    upsert: false,
    contentType: file.type || 'video/mp4',
  })
  if (error) return { error: error.message }
  const { data } = supabase.storage.from('shop-assets').getPublicUrl(path)
  return { url: data.publicUrl }
}
