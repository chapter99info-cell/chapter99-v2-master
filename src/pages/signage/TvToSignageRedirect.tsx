import { useEffect, useState } from 'react'
import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { getShopBySlug } from '../../config/shopRegistry'
import { resolveEffectiveShopSlug } from '../../lib/shopDomain'
import { fetchShopBySlug } from '../../lib/shopService'

/**
 * Legacy TV kiosk URLs → /signage/:shopId
 * Supports /tv/:slug and /tv-kiosk?shop=slug (slug ≠ shopId, e.g. mira → shop-001).
 */
export default function TvToSignageRedirect() {
  const { slug: pathSlug } = useParams<{ slug?: string }>()
  const [searchParams] = useSearchParams()
  const raw =
    searchParams.get('shop')?.trim().toLowerCase() ||
    pathSlug?.trim().toLowerCase() ||
    null
  const slug = resolveEffectiveShopSlug(raw)

  const [shopId, setShopId] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    if (!slug) {
      setFailed(true)
      return
    }

    const fromRegistry = getShopBySlug(slug)?.shopId?.trim()
    if (fromRegistry) {
      setShopId(fromRegistry)
      return
    }

    void fetchShopBySlug(slug).then((shop) => {
      if (cancelled) return
      if (shop?.id) setShopId(shop.id)
      else setFailed(true)
    })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (failed) {
    return <Navigate to="/shop-not-found" replace />
  }
  if (!shopId) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#000',
          color: '#fff',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        Redirecting to Digital Signage…
      </div>
    )
  }
  return <Navigate to={`/signage/${encodeURIComponent(shopId)}`} replace />
}
