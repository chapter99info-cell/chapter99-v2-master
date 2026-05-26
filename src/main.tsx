import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/tailwind.css'
import './index.css'
import Root from './Root.tsx'

registerSW({
  immediate: true,
  onOfflineReady() {
    console.info('[PWA] App shell cached for offline use')
  },
  onNeedRefresh() {
    console.info('[PWA] New version available — refresh to update')
  },
})

class RootErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Trip2Talk] Root render failed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            background: '#0a0a0f',
            color: '#fbbf24',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 18, marginBottom: 12 }}>Trip2Talk failed to load</h1>
          <pre style={{ color: '#fca5a5', whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error}</pre>
        </div>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootErrorBoundary>
      <Root />
    </RootErrorBoundary>
  </StrictMode>,
)
