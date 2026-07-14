import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { resolveEffectiveShopSlug } from '../../lib/shopDomain'
import { fetchShopBySlug } from '../../lib/shopService'

const DEFAULT_TITLE = 'Chapter99'
const DEFAULT_DESCRIPTION = 'Chapter99 staff POS, queue, and shop management'
const THEME_COLOR = '#1a3d2b'

/**
 * Sets the browser tab title / meta description per-shop based on the
 * resolved ?shop= slug (or custom domain). Falls back to a neutral
 * "Chapter99" title when no shop is resolved (e.g. Super Admin / staff
 * platform host with no ?shop= param). Do NOT hardcode a single shop
 * name here — this component runs for every shop's site.
 */
export default function ProductHead() {
  const [searchParams] = useSearchParams()
  const urlSlug = searchParams.get('shop')?.trim().toLowerCase() || null
  const effectiveSlug = resolveEffectiveShopSlug(urlSlug)

  useEffect(() => {
    const theme = document.querySelector('meta[name="theme-color"]')
    if (theme) theme.setAttribute('content', THEME_COLOR)

    if (!effectiveSlug) {
      document.title = DEFAULT_TITLE
      const meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', DEFAULT_DESCRIPTION)
      return
    }

    let cancelled = false
    fetchShopBySlug(effectiveSlug).then(shop => {
      if (cancelled) return
      const name = shop?.name || DEFAULT_TITLE
      document.title = name
      const meta = document.querySelector('meta[name="description"]')
      if (meta) meta.setAttribute('content', `${name} — book online`)
    })

    return () => {
      cancelled = true
    }
  }, [effectiveSlug])

  return null
}
