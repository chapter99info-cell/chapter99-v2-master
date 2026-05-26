import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useShopPages } from '../../hooks/useShopPages'
import type { PublicPageKey } from '../../types/shopPages'

interface PublicPageGuardProps {
  page: PublicPageKey
  children: ReactNode
}

/** Blocks disabled public pages — no content flash while shop settings load. */
export default function PublicPageGuard({ page, children }: PublicPageGuardProps) {
  const { ready, isPageEnabled, redirectTo } = useShopPages()
  const location = useLocation()

  if (!ready) {
    return (
      <div className="public-page-loading" role="status" aria-live="polite">
        <p>Loading…</p>
      </div>
    )
  }

  if (!isPageEnabled(page)) {
    const targetPath = redirectTo.split('?')[0] || '/book'
    // Avoid redirect loop when disabled_redirect_path points at the current page
    if (location.pathname === targetPath) {
      return <>{children}</>
    }
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
