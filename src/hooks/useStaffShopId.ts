import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { fetchShopBySlug } from '../lib/shopService'
import { resolveEffectiveShopSlug } from '../lib/shopDomain'
import { SHOP_ID } from '../lib/supabase'

export function useStaffShopId(): {
  shopId: string
  shopSlug: string | null
  resolving: boolean
  resolveError: string | null
} {
  const [searchParams] = useSearchParams()
  const urlSlug = searchParams.get('shop')?.trim().toLowerCase() || null
  const effectiveSlug = resolveEffectiveShopSlug(urlSlug)

  const [shopId, setShopId] = useState(SHOP_ID)
  const [resolving, setResolving] = useState(Boolean(effectiveSlug))
  const [resolveError, setResolveError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!effectiveSlug) {
      setShopId(SHOP_ID)
      setResolveError(null)
      setResolving(false)
      return
    }

    setResolving(true)
    setResolveError(null)

    fetchShopBySlug(effectiveSlug).then(shop => {
      if (cancelled) return
      if (!shop) {
        setResolveError(`Shop "${effectiveSlug}" was not found.`)
        setShopId(SHOP_ID)
      } else {
        setShopId(shop.id)
        setResolveError(null)
      }
      setResolving(false)
    })

    return () => {
      cancelled = true
    }
  }, [effectiveSlug])

  return {
    shopId,
    shopSlug: effectiveSlug,
    resolving,
    resolveError,
  }
}
