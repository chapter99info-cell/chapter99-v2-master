import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useShopPages } from '../../hooks/useShopPages'
import type { PublicPageKey } from '../../types/shopPages'

interface PublicPageGuardProps {
  page: PublicPageKey
  children: ReactNode
}

/** Blocks disabled public pages — no content flash while shop settings load. */
export default function PublicPageGuard({ page, children }: PublicPageGuardProps) {
  const { ready, isPageEnabled, redirectTo } = useShopPages()

  if (!ready) return null

  if (!isPageEnabled(page)) {
    return <Navigate to={redirectTo} replace />
  }

  return <>{children}</>
}
