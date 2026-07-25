import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'

/**
 * Lightweight health probe for remote Fire Stick monitoring.
 * Renders plain text JSON (scrapable) and logs a console heartbeat.
 */
export default function SignageHealthPage() {
  const { shopId: rawId } = useParams<{ shopId: string }>()
  const shopId = rawId?.trim() || 'unknown'
  const [ts, setTs] = useState(() => new Date().toISOString())

  useEffect(() => {
    const tick = () => {
      const now = new Date().toISOString()
      setTs(now)
      console.log(`[signage-health] ${now} shopId=${shopId}`)
    }
    tick()
    const id = window.setInterval(tick, 60_000)
    return () => window.clearInterval(id)
  }, [shopId])

  const body = JSON.stringify(
    {
      ok: true,
      route: 'signage-health',
      shopId,
      timestamp: ts,
      online: typeof navigator !== 'undefined' ? navigator.onLine : null,
    },
    null,
    2
  )

  return (
    <pre
      style={{
        margin: 0,
        padding: 16,
        minHeight: '100vh',
        background: '#0a0a0f',
        color: '#a7f3d0',
        fontFamily: 'ui-monospace, monospace',
        fontSize: 14,
        whiteSpace: 'pre-wrap',
      }}
    >
      {body}
    </pre>
  )
}
