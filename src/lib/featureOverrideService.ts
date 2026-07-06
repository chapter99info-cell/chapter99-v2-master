import { supabase } from './supabase'
import {
  parseFeatureOverrides,
  type FeatureOverrideId,
} from './shopFeatureAccess'

function logFeatureOverrideError(action: string, error: unknown) {
  if (import.meta.env.DEV) {
    console.error(`[featureOverrideService] ${action}`, error)
  }
}

export async function fetchShopFeatureOverrides(
  shopId: string
): Promise<{ overrides: Record<string, boolean>; error?: string }> {
  const { data, error } = await supabase
    .from('shops')
    .select('feature_overrides')
    .eq('id', shopId)
    .maybeSingle()

  if (error) {
    logFeatureOverrideError('fetchShopFeatureOverrides', error)
    return { overrides: {}, error: error.message }
  }
  if (!data) {
    return { overrides: {}, error: 'Shop not found' }
  }
  return { overrides: parseFeatureOverrides(data.feature_overrides) }
}

export async function saveShopFeatureOverrides(
  shopId: string,
  overrides: Record<string, boolean>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update({ feature_overrides: overrides })
    .eq('id', shopId)

  if (error) {
    logFeatureOverrideError('saveShopFeatureOverrides', error)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function setShopFeatureOverride(
  shopId: string,
  featureId: FeatureOverrideId,
  enabled: boolean | null,
  currentOverrides: Record<string, boolean>
): Promise<{ ok: boolean; error?: string; overrides: Record<string, boolean> }> {
  const next = { ...currentOverrides }
  if (enabled === null) {
    delete next[featureId]
  } else {
    next[featureId] = enabled
  }
  const result = await saveShopFeatureOverrides(shopId, next)
  return { ...result, overrides: next }
}

export async function setAllShopFeatureOverrides(
  shopId: string,
  overrides: Record<string, boolean>
): Promise<{ ok: boolean; error?: string; overrides: Record<string, boolean> }> {
  const result = await saveShopFeatureOverrides(shopId, overrides)
  return { ...result, overrides }
}
