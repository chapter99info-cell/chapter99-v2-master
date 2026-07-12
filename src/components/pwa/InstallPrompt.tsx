import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import './PwaBanners.css'

const DISMISS_KEY = 'chapter99-pwa-install-dismissed'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isMobileDevice(): boolean {
  if (typeof window === 'undefined') return false
  const ua = navigator.userAgent
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function isIos(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

export default function InstallPrompt() {
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosHint, setIosHint] = useState(false)

  const isDashboardRoute =
    location.pathname === '/' ||
    location.pathname.startsWith('/staff') ||
    location.pathname.startsWith('/chapter99/staff')

  useEffect(() => {
    if (!isMobileDevice() || isStandalone() || !isDashboardRoute) return
    if (localStorage.getItem(DISMISS_KEY) === '1') return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
      setIosHint(false)
    }

    window.addEventListener('beforeinstallprompt', onBip)

    if (isIos()) {
      setIosHint(true)
      setVisible(true)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [isDashboardRoute])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  async function install() {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    dismiss()
  }

  if (!visible) return null

  return (
    <div className="pwa-install-banner" role="dialog" aria-label="Install app">
      <div className="pwa-install-body">
        <strong>Add Chapter99 Staff to your Home Screen</strong>
        {iosHint ? (
          <p>
            Tap <span className="pwa-install-kbd">Share</span> then{' '}
            <span className="pwa-install-kbd">Add to Home Screen</span>.
          </p>
        ) : (
          <p>Install for quick access like a native app — opens staff PIN login.</p>
        )}
      </div>
      <div className="pwa-install-actions">
        {!iosHint && deferredPrompt && (
          <button type="button" className="pwa-install-btn primary" onClick={install}>
            Install
          </button>
        )}
        <button type="button" className="pwa-install-btn" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}
