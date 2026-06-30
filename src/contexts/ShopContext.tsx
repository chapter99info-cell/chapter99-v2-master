import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchShop, fetchShopBySlug } from '../lib/shopService'
import { SHOP_UPDATED_EVENT } from '../lib/shopLogo'
import { SHOP_ID } from '../lib/supabase'
import {
  isOnCustomShopDomain,
  isPlatformHost,
  resolveEffectiveShopSlug,
  resolveShopFromCurrentHost,
} from '../lib/shopDomain'
import { reportUnmappedShopDomainClient } from '../lib/shopDomainAlertClient'
import type { Shop } from '../types/pos'
import type { BusinessType } from '../types/shop'

const SHOP_QUERY_KEY = 'shop'

export interface ShopContextValue {
  shop: Shop | null
  shopId: string | null
  shopSlug: string | null
  businessType: BusinessType | null
  loading: boolean
  error: string | null
  /** Append ?shop=slug to internal public links when slug is active */
  withShopQuery: (path: string) => string
}

const ShopContext = createContext<ShopContextValue | null>(null)

function appendShopQuery(path: string, slug: string | null): string {
  if (!slug || isOnCustomShopDomain()) return path
  const [pathname, search = ''] = path.split('?')
  const params = new URLSearchParams(search)
  params.set(SHOP_QUERY_KEY, slug)
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const urlSlug = searchParams.get(SHOP_QUERY_KEY)?.trim().toLowerCase() || null
  const effectiveSlug = resolveEffectiveShopSlug(urlSlug)

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reloadShop = useCallback(async () => {
    setError(null)
    if (effectiveSlug) {
      const resolved = await fetchShopBySlug(effectiveSlug)
      if (!resolved) {
        setShop(null)
        setError(
          `Shop "${effectiveSlug}" was not found. Check the booking link from the store website.`
        )
        return
      }
      setShop(resolved)
      return
    }
    setShop(await fetchShop(SHOP_ID))
  }, [effectiveSlug])

  useEffect(() => {
    let cancelled = false
    async function resolve() {
      setLoading(true)
      await reloadShop()
      if (!cancelled) setLoading(false)
    }
    resolve()
    return () => {
      cancelled = true
    }
  }, [reloadShop])

  useEffect(() => {
    const onUpdated = () => {
      void reloadShop()
    }
    window.addEventListener(SHOP_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SHOP_UPDATED_EVENT, onUpdated)
  }, [reloadShop])

  useEffect(() => {
    if (typeof window === 'undefined' || effectiveSlug) return
    const host = window.location.hostname
    if (isPlatformHost(host)) return
    const resolved = resolveShopFromCurrentHost()
    if (!resolved.needsAlert) return
    reportUnmappedShopDomainClient({
      host,
      source: 'shop-context-fallback',
      path: window.location.pathname,
    })
  }, [effectiveSlug])

  const shopSlug = effectiveSlug ?? shop?.slug ?? null
  const shopId = shop?.id ?? null
  const businessType = shop?.businessType ?? null

  const withShopQuery = useCallback(
    (path: string) => appendShopQuery(path, shopSlug),
    [shopSlug]
  )

  const value = useMemo<ShopContextValue>(
    () => ({
      shop,
      shopId,
      shopSlug,
      businessType,
      loading,
      error,
      withShopQuery,
    }),
    [shop, shopId, shopSlug, businessType, loading, error, withShopQuery]
  )

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>
}

export function useShopContext(): ShopContextValue {
  const ctx = useContext(ShopContext)
  if (!ctx) {
    throw new Error('useShopContext must be used within ShopProvider')
  }
  return ctx
}

/** Read ?shop= without requiring full shop resolution (e.g. link builders). */
export function useShopQueryParam(): string | null {
  const [searchParams] = useSearchParams()
  const urlSlug = searchParams.get(SHOP_QUERY_KEY)?.trim().toLowerCase() || null
  return resolveEffectiveShopSlug(urlSlug)
}

export { useShopPages } from '../hooks/useShopPages'
