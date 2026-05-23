import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import './PwaBanners.css'

export default function OfflineBanner() {
  const online = useOnlineStatus()

  if (online) return null

  return (
    <div className="pwa-offline-banner" role="status" aria-live="polite">
      <span className="pwa-offline-icon" aria-hidden>📡</span>
      <span>You are offline — some features may not work.</span>
    </div>
  )
}
