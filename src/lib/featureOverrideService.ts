import { supabase } from './supabase'
import {
  parseFeatureOverrides,
  type FeatureOverrideId,
} from './shopFeatureAccess'

export async function fetchShopFeatureOverrides(
  shopId: string
): Promise<Record<string, boolean>> {
  const { data, error } = await supabase
    .from('shops')
    .select('feature_overrides')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) return {}
  return parseFeatureOverrides(data.feature_overrides)
}

export async function saveShopFeatureOverrides(
  shopId: string,
  overrides: Record<string, boolean>
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update({ feature_overrides: overrides })
    .eq('id', shopId)

  if (error) return { ok: false, error: error.message }
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
