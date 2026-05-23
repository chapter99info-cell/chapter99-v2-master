import { DEFAULT_SHOP_PAGE_VISIBILITY, normalizeRedirectPath } from './shopPages'

export interface ShopWebsiteSettings {
  shopId: string
  slug?: string
  pageHomeEnabled: boolean
  pageServicesEnabled: boolean
  pageVouchersEnabled: boolean
  pageAboutEnabled: boolean
  disabledRedirectPath: string
  logoUrl: string
  heroImageUrl: string
  heroTitle: string
  heroSubtitle: string
  aboutText: string
  aboutPhone: string
  aboutAddress: string
  googleMapsUrl: string
}

export const REDIRECT_PATH_OPTIONS = [
  { value: '/book', label: 'Book / Order (/book)' },
  { value: '/services', label: 'Services / Menu (/services)' },
  { value: '/voucher', label: 'Gift vouchers (/voucher)' },
  { value: '/about', label: 'About (/about)' },
  { value: '/', label: 'Home (/)' },
] as const

export function defaultWebsiteSettings(shopId: string): ShopWebsiteSettings {
  return {
    shopId,
    ...DEFAULT_SHOP_PAGE_VISIBILITY,
    heroTitle: '',
    heroSubtitle: '',
    aboutText: '',
    aboutPhone: '',
    aboutAddress: '',
    googleMapsUrl: '',
    logoUrl: '',
    heroImageUrl: '',
  }
}

export interface ServiceImageRow {
  id: string
  nameEn: string
  imageUrl: string
  active: boolean
}

export function rowToWebsiteSettings(row: Record<string, unknown>): ShopWebsiteSettings {
  return {
    shopId: String(row.id),
    slug: (row.slug as string) || undefined,
    pageHomeEnabled: row.page_home_enabled !== false,
    pageServicesEnabled: row.page_services_enabled !== false,
    pageVouchersEnabled: row.page_vouchers_enabled !== false,
    pageAboutEnabled: row.page_about_enabled !== false,
    disabledRedirectPath: normalizeRedirectPath(
      (row.disabled_redirect_path as string) || DEFAULT_SHOP_PAGE_VISIBILITY.disabledRedirectPath
    ),
    logoUrl: (row.logo_url as string) ?? '',
    heroImageUrl: (row.hero_image_url as string) ?? '',
    heroTitle: (row.hero_title as string) ?? '',
    heroSubtitle: (row.hero_subtitle as string) ?? '',
    aboutText: (row.about_text as string) ?? '',
    aboutPhone: (row.about_phone as string) ?? '',
    aboutAddress: (row.about_address as string) ?? '',
    googleMapsUrl: (row.google_maps_url as string) ?? '',
  }
}

export function websiteSettingsToRow(input: ShopWebsiteSettings) {
  return {
    page_home_enabled: input.pageHomeEnabled,
    page_services_enabled: input.pageServicesEnabled,
    page_vouchers_enabled: input.pageVouchersEnabled,
    page_about_enabled: input.pageAboutEnabled,
    disabled_redirect_path: normalizeRedirectPath(input.disabledRedirectPath),
    logo_url: input.logoUrl.trim() || null,
    hero_image_url: input.heroImageUrl.trim() || null,
    hero_title: input.heroTitle.trim() || null,
    hero_subtitle: input.heroSubtitle.trim() || null,
    about_text: input.aboutText.trim() || null,
    about_phone: input.aboutPhone.trim() || null,
    about_address: input.aboutAddress.trim() || null,
    google_maps_url: input.googleMapsUrl.trim() || null,
  }
}
