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
import { SHOP_ID } from '../lib/supabase'
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
  if (!slug) return path
  const [pathname, search = ''] = path.split('?')
  const params = new URLSearchParams(search)
  params.set(SHOP_QUERY_KEY, slug)
  const qs = params.toString()
  return qs ? `${pathname}?${qs}` : pathname
}

export function ShopProvider({ children }: { children: ReactNode }) {
  const [searchParams] = useSearchParams()
  const urlSlug = searchParams.get(SHOP_QUERY_KEY)?.trim().toLowerCase() || null

  const [shop, setShop] = useState<Shop | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function resolve() {
      setLoading(true)
      setError(null)

      if (urlSlug) {
        const resolved = await fetchShopBySlug(urlSlug)
        if (cancelled) return
        if (!resolved) {
          setShop(null)
          setError(`Shop "${urlSlug}" was not found. Check the booking link from the store website.`)
          setLoading(false)
          return
        }
        setShop(resolved)
        setLoading(false)
        return
      }

      const fallback = await fetchShop(SHOP_ID)
      if (cancelled) return
      setShop(fallback)
      setLoading(false)
    }

    resolve()
    return () => {
      cancelled = true
    }
  }, [urlSlug])

  const shopSlug = urlSlug ?? shop?.slug ?? null
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
  return searchParams.get(SHOP_QUERY_KEY)?.trim().toLowerCase() || null
}
