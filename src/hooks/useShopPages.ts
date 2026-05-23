import { useMemo } from 'react'
import { useShopContext } from '../contexts/ShopContext'
import {
  DEFAULT_SHOP_PAGE_VISIBILITY,
  isPublicPageEnabled,
  normalizeRedirectPath,
  type PublicPageKey,
  type ShopPageVisibility,
} from '../types/shopPages'

export interface UseShopPagesResult extends ShopPageVisibility {
  /** Shop resolved and page flags are ready for routing */
  ready: boolean
  /** Redirect target with ?shop= preserved */
  redirectTo: string
  isPageEnabled: (page: PublicPageKey) => boolean
}

export function shopToPageVisibility(
  shop: {
    pageHomeEnabled?: boolean
    pageServicesEnabled?: boolean
    pageVouchersEnabled?: boolean
    pageAboutEnabled?: boolean
    disabledRedirectPath?: string
  } | null
): ShopPageVisibility {
  if (!shop) return { ...DEFAULT_SHOP_PAGE_VISIBILITY }
  return {
    pageHomeEnabled: shop.pageHomeEnabled ?? true,
    pageServicesEnabled: shop.pageServicesEnabled ?? true,
    pageVouchersEnabled: shop.pageVouchersEnabled ?? true,
    pageAboutEnabled: shop.pageAboutEnabled ?? true,
    disabledRedirectPath: normalizeRedirectPath(
      shop.disabledRedirectPath ?? DEFAULT_SHOP_PAGE_VISIBILITY.disabledRedirectPath
    ),
  }
}

export function useShopPages(): UseShopPagesResult {
  const { shop, loading, withShopQuery } = useShopContext()

  return useMemo(() => {
    const visibility = shopToPageVisibility(shop)
    const redirectTo = withShopQuery(visibility.disabledRedirectPath)

    return {
      ...visibility,
      ready: !loading && shop !== null,
      redirectTo,
      isPageEnabled: (page: PublicPageKey) => isPublicPageEnabled(visibility, page),
    }
  }, [shop, loading, withShopQuery])
}
