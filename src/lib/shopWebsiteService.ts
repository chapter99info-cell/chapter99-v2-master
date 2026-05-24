import { supabase } from './supabase'
import {
  defaultWebsiteSettings,
  rowToWebsiteSettings,
  websiteSettingsToRow,
  type ServiceImageRow,
  type ShopWebsiteSettings,
} from '../types/shopWebsite'

const WEBSITE_COLUMNS =
  'id, slug, logo_url, hero_image_url, page_home_enabled, page_services_enabled, page_vouchers_enabled, page_about_enabled, disabled_redirect_path, hero_title, hero_subtitle, about_text, about_phone, about_address, google_maps_url, privacy_policy_url, terms_url'

export async function fetchShopWebsiteSettings(
  shopId: string
): Promise<ShopWebsiteSettings> {
  const { data, error } = await supabase
    .from('shops')
    .select(WEBSITE_COLUMNS)
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) return defaultWebsiteSettings(shopId)
  return rowToWebsiteSettings(data as Record<string, unknown>)
}

export async function saveShopWebsiteSettings(
  settings: ShopWebsiteSettings
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update(websiteSettingsToRow(settings))
    .eq('id', settings.shopId)

  if (error) {
    console.error('[saveShopWebsiteSettings] failed', {
      shopId: settings.shopId,
      message: error.message,
      error,
    })
    const hint = error.message.includes('hero_image_url')
      ? ' — run supabase/24-shop-website-images.sql in Supabase'
      : ''
    return { ok: false, error: error.message + hint }
  }
  console.log('[saveShopWebsiteSettings] ok', {
    shopId: settings.shopId,
    hero_image_url: settings.heroImageUrl || null,
    logo_url: settings.logoUrl || null,
  })
  return { ok: true }
}

export async function fetchServiceImages(shopId: string): Promise<ServiceImageRow[]> {
  const { data, error } = await supabase
    .from('services')
    .select('id, name_en, image_url, active, sort_order')
    .eq('shop_id', shopId)
    .order('sort_order', { ascending: true })
    .order('name_en', { ascending: true })

  if (error || !data) return []

  return data.map(row => ({
    id: row.id as string,
    nameEn: row.name_en as string,
    imageUrl: (row.image_url as string) ?? '',
    active: row.active !== false,
  }))
}

export async function saveServiceImageUrl(
  serviceId: string,
  imageUrl: string | null
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('services')
    .update({ image_url: imageUrl })
    .eq('id', serviceId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
