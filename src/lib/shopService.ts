// Chapter99 V4 — Shop settings load/save + logo upload

import { supabase, SHOP_ID } from './supabase'
import type { Shop } from '../types/pos'
import { DEFAULT_SHOP_PAGE_VISIBILITY, normalizeRedirectPath } from '../types/shopPages'
import { normalizeShopPlan } from '../types/plan'
import { isBusinessType, type BusinessType } from '../types/shop'

export interface ShopRow {
  id: string
  slug: string | null
  business_type: string | null
  name: string
  abn: string | null
  address: string | null
  phone: string | null
  email: string | null
  notification_email: string | null
  gst_registered: boolean | null
  currency: string | null
  timezone: string | null
  logo_url: string | null
  theme_color: string | null
  provider_name: string | null
  provider_number: string | null
  signature_url: string | null
  card_surcharge: number | null
  amex_surcharge: number | null
  payid_bsb: string | null
  payid_account: string | null
  stripe_pub_key: string | null
  google_sheet_url: string | null
  google_sheet_sync_enabled: boolean | null
  google_review_url: string | null
  page_home_enabled: boolean | null
  page_services_enabled: boolean | null
  page_vouchers_enabled: boolean | null
  page_about_enabled: boolean | null
  disabled_redirect_path: string | null
  hero_image_url: string | null
  hero_title: string | null
  hero_subtitle: string | null
  about_text: string | null
  about_phone: string | null
  about_address: string | null
  google_maps_url: string | null
  plan: string | null
  addon_stripe: boolean | null
  addon_sms: boolean | null
  addon_website: boolean | null
  addon_reports: boolean | null
}

export interface ShopSettingsInput {
  name: string
  abn: string
  address: string
  phone: string
  email: string
  notificationEmail: string
  gstRegistered: boolean
  logoUrl?: string
  themeColor: string
  providerName: string
  providerNumber: string
  signatureUrl?: string
  cardSurchargeRate: number
  amexSurchargeRate: number
  payidBsb: string
  payidAccount: string
  googleSheetUrl: string
  googleSheetSyncEnabled: boolean
  googleReviewUrl: string
}

const DEFAULT_SHOP: Shop = {
  id: SHOP_ID,
  businessType: 'massage',
  plan: 'starter',
  addonStripe: false,
  addonSms: false,
  addonWebsite: false,
  addonReports: false,
  name: 'Chapter99 Demo Shop',
  abn: '',
  address: '',
  phone: '',
  email: '',
  gstRegistered: true,
  currency: 'AUD',
  timezone: 'Australia/Sydney',
  themeColor: '#0F6E56',
  providerName: '',
  providerNumber: '',
  cardSurchargeRate: 0.015,
  amexSurchargeRate: 0.02,
  ...DEFAULT_SHOP_PAGE_VISIBILITY,
}

export function mapRowToShop(row: ShopRow): Shop {
  return {
    id: row.id,
    slug: row.slug ?? undefined,
    businessType: isBusinessType(row.business_type) ? row.business_type : 'massage',
    plan: normalizeShopPlan(row.plan),
    addonStripe: row.addon_stripe === true,
    addonSms: row.addon_sms === true,
    addonWebsite: row.addon_website === true,
    addonReports: row.addon_reports === true,
    name: row.name,
    abn: row.abn ?? '',
    address: row.address ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    notificationEmail: row.notification_email ?? '',
    gstRegistered: row.gst_registered ?? true,
    currency: 'AUD',
    timezone: row.timezone ?? 'Australia/Sydney',
    logoUrl: row.logo_url ?? undefined,
    themeColor: row.theme_color ?? '#0F6E56',
    providerName: row.provider_name ?? '',
    providerNumber: row.provider_number ?? '',
    signatureUrl: row.signature_url ?? undefined,
    cardSurchargeRate: Number(row.card_surcharge ?? 0.015),
    amexSurchargeRate: Number(row.amex_surcharge ?? 0.02),
    payidBsb: row.payid_bsb ?? undefined,
    payidAccount: row.payid_account ?? undefined,
    stripePublicKey: row.stripe_pub_key ?? undefined,
    googleSheetUrl: row.google_sheet_url ?? undefined,
    googleSheetSyncEnabled: row.google_sheet_sync_enabled ?? false,
    googleReviewUrl: row.google_review_url ?? undefined,
    pageHomeEnabled: row.page_home_enabled ?? DEFAULT_SHOP_PAGE_VISIBILITY.pageHomeEnabled,
    pageServicesEnabled:
      row.page_services_enabled ?? DEFAULT_SHOP_PAGE_VISIBILITY.pageServicesEnabled,
    pageVouchersEnabled:
      row.page_vouchers_enabled ?? DEFAULT_SHOP_PAGE_VISIBILITY.pageVouchersEnabled,
    pageAboutEnabled: row.page_about_enabled ?? DEFAULT_SHOP_PAGE_VISIBILITY.pageAboutEnabled,
    disabledRedirectPath: normalizeRedirectPath(
      row.disabled_redirect_path ?? DEFAULT_SHOP_PAGE_VISIBILITY.disabledRedirectPath
    ),
    heroImageUrl: row.hero_image_url ?? undefined,
    heroTitle: row.hero_title ?? undefined,
    heroSubtitle: row.hero_subtitle ?? undefined,
    aboutText: row.about_text ?? undefined,
    aboutPhone: row.about_phone ?? undefined,
    aboutAddress: row.about_address ?? undefined,
    googleMapsUrl: row.google_maps_url ?? undefined,
  }
}

export function shopToUpdatePayload(input: ShopSettingsInput) {
  return {
    name: input.name,
    abn: input.abn || null,
    address: input.address || null,
    phone: input.phone || null,
    email: input.email || null,
    notification_email: input.notificationEmail || null,
    gst_registered: input.gstRegistered,
    logo_url: input.logoUrl || null,
    theme_color: input.themeColor,
    provider_name: input.providerName || null,
    provider_number: input.providerNumber || null,
    signature_url: input.signatureUrl || null,
    card_surcharge: input.cardSurchargeRate,
    amex_surcharge: input.amexSurchargeRate,
    payid_bsb: input.payidBsb || null,
    payid_account: input.payidAccount || null,
    google_sheet_url: input.googleSheetUrl || null,
    google_sheet_sync_enabled: input.googleSheetSyncEnabled,
    google_review_url: input.googleReviewUrl || null,
  }
}

export async function fetchShop(shopId: string = SHOP_ID): Promise<Shop> {
  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('id', shopId)
    .maybeSingle()

  if (error || !data) return { ...DEFAULT_SHOP, id: shopId }
  return mapRowToShop(data as ShopRow)
}

/** Resolve `?shop=mira` slug to shop row (active shops only). */
export async function fetchShopBySlug(slug: string): Promise<Shop | null> {
  const key = slug.trim().toLowerCase()
  if (!key) return null

  const { data, error } = await supabase
    .from('shops')
    .select('*')
    .eq('slug', key)
    .eq('active', true)
    .maybeSingle()

  if (error || !data) return null
  return mapRowToShop(data as ShopRow)
}

export async function saveShopBusinessType(
  shopId: string,
  businessType: BusinessType
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('shops')
    .update({ business_type: businessType })
    .eq('id', shopId)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function saveShopSettings(
  shopId: string,
  input: ShopSettingsInput
): Promise<{ ok: boolean; error?: string }> {
  const payload = shopToUpdatePayload(input)
  const { data: existing } = await supabase
    .from('shops')
    .select('id')
    .eq('id', shopId)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase.from('shops').update(payload).eq('id', shopId)
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  }

  const { error } = await supabase.from('shops').insert({
    id: shopId,
    plan: 'starter',
    active: true,
    ...payload,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Email that receives new-booking alerts; falls back to shop contact email. */
export function resolveShopNotificationEmail(shop: Shop): string {
  return (shop.notificationEmail?.trim() || shop.email?.trim() || '')
}

export type ShopAssetKind = 'logo' | 'signature' | 'hero'

export async function uploadShopAsset(
  shopId: string,
  file: File,
  kind: ShopAssetKind
): Promise<{ url?: string; error?: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${shopId}/${kind}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('shop-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return {
      error:
        uploadError.message.includes('Bucket not found')
          ? 'Storage bucket missing — run supabase/05-receipt-system.sql'
          : uploadError.message,
    }
  }

  const { data } = supabase.storage.from('shop-assets').getPublicUrl(path)
  return { url: data.publicUrl }
}

export async function uploadServiceImage(
  shopId: string,
  serviceId: string,
  file: File
): Promise<{ url?: string; error?: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const path = `${shopId}/services/${serviceId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('shop-assets')
    .upload(path, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    return {
      error:
        uploadError.message.includes('Bucket not found')
          ? 'Storage bucket missing — run supabase/05-receipt-system.sql'
          : uploadError.message,
    }
  }

  const { data } = supabase.storage.from('shop-assets').getPublicUrl(path)
  return { url: data.publicUrl }
}
