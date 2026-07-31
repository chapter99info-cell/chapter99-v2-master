import { lazy, Suspense } from 'react'
import { useShopContext } from '../../contexts/ShopContext'
import { getThemeHomePage, isThemeId } from '../../lib/themeRegistry'

// Legacy default landing page — used whenever a shop has no themeId set
// (every shop created before the theme system existed, e.g. Mira).
const DefaultHomePage = lazy(() => import('../../pages/HomePage'))

function HomeFallback() {
  return (
    <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center text-[#6B7280] text-sm">
      Loading…
    </div>
  )
}

/**
 * Chooses which landing-page component to render for the "/" route.
 * - shop.themeId set + valid  -> lazy-load that theme's HomePage from themeRegistry
 * - shop.themeId missing/invalid -> fall back to the original hardcoded pages/HomePage.tsx
 * This keeps every existing shop (no themeId in the DB yet) rendering exactly as before.
 */
export default function HomeRouter() {
  const { shop, loading } = useShopContext()

  if (loading) {
    return <HomeFallback />
  }

  if (shop?.themeId && isThemeId(shop.themeId)) {
    const ThemeHomePage = getThemeHomePage(shop.themeId)
    return (
      // Themes are designed edge-to-edge; .theme-full-bleed (in PublicLayout.css)
      // breaks them out of .public-main's 960px reading-width constraint.
      <div className="theme-full-bleed">
        <Suspense fallback={<HomeFallback />}>
          <ThemeHomePage />
        </Suspense>
      </div>
    )
  }

  return (
    <Suspense fallback={<HomeFallback />}>
      <DefaultHomePage />
    </Suspense>
  )
}
