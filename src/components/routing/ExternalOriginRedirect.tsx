import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { buildExternalUrl } from '../../lib/productDomain'

/**
 * Sends the browser to the same path on another product origin
 * (e.g. chapter99info.tech/book → trip2talk.app stays on spa only).
 */
export default function ExternalOriginRedirect({ origin }: { origin: string }) {
  const { pathname, search, hash } = useLocation()

  useEffect(() => {
    const url = buildExternalUrl(origin, pathname, search, hash)
    window.location.replace(url)
  }, [origin, pathname, search, hash])

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif',
        color: '#8899aa',
      }}
    >
      Redirecting…
    </div>
  )
}
