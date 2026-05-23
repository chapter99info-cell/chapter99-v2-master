/** Public storefront pages that can be toggled per shop */
export type PublicPageKey = 'home' | 'services' | 'vouchers' | 'about'

export interface ShopPageVisibility {
  pageHomeEnabled: boolean
  pageServicesEnabled: boolean
  pageVouchersEnabled: boolean
  pageAboutEnabled: boolean
  disabledRedirectPath: string
}

export const DEFAULT_SHOP_PAGE_VISIBILITY: ShopPageVisibility = {
  pageHomeEnabled: true,
  pageServicesEnabled: true,
  pageVouchersEnabled: true,
  pageAboutEnabled: true,
  disabledRedirectPath: '/book',
}

export function normalizeRedirectPath(path: string): string {
  const trimmed = path.trim() || DEFAULT_SHOP_PAGE_VISIBILITY.disabledRedirectPath
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`
}

export function isPublicPageEnabled(
  visibility: ShopPageVisibility,
  page: PublicPageKey
): boolean {
  switch (page) {
    case 'home':
      return visibility.pageHomeEnabled
    case 'services':
      return visibility.pageServicesEnabled
    case 'vouchers':
      return visibility.pageVouchersEnabled
    case 'about':
      return visibility.pageAboutEnabled
    default:
      return true
  }
}
