import { Component, type ErrorInfo, type ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './styles/tailwind.css'
import './index.css'

console.log('[Chapter99] main.tsx — script started')
console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL?.substring(0, 30))
console.log(
  '[Chapter99] Supabase anon key set:',
  Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY)
)

function renderFatalError(title: string, detail: string) {
  const root = document.getElementById('root')
  if (!root) return
  root.innerHTML = `
    <div style="min-height:100vh;padding:24px;background:#0a0a0f;color:#e5e5e5;font-family:system-ui,sans-serif">
      <h1 style="font-size:20px;color:#fbbf24;margin:0 0 12px">${title}</h1>
      <pre style="color:#fca5a5;white-space:pre-wrap;font-size:13px;line-height:1.5;margin:0 0 16px">${detail}</pre>
      <p style="font-size:12px;color:#a3a3a3;margin:0 0 16px">
        Supabase URL (first 30): ${import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) ?? '(missing)'}
      </p>
      <button type="button" onclick="location.reload()" style="padding:10px 16px;background:#1a3d2b;color:#fff;border:none;border-radius:8px;cursor:pointer">
        Reload page
      </button>
    </div>
  `
}

class RootErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Chapter99] Root render failed:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message || String(this.state.error)
      const stack = this.state.error.stack ?? ''
      return (
        <div
          style={{
            minHeight: '100vh',
            padding: 24,
            background: '#0a0a0f',
            color: '#e5e5e5',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: 20, color: '#fbbf24', margin: '0 0 12px' }}>
            Application failed to load
          </h1>
          <pre
            style={{
              color: '#fca5a5',
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              lineHeight: 1.5,
              margin: '0 0 12px',
            }}
          >
            {msg}
          </pre>
          {stack ? (
            <pre
              style={{
                color: '#737373',
                whiteSpace: 'pre-wrap',
                fontSize: 11,
                margin: '0 0 16px',
                maxHeight: 200,
                overflow: 'auto',
              }}
            >
              {stack}
            </pre>
          ) : null}
          <p style={{ fontSize: 12, color: '#a3a3a3', margin: '0 0 16px' }}>
            Supabase URL (first 30):{' '}
            {import.meta.env.VITE_SUPABASE_URL?.substring(0, 30) ?? '(missing)'}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 16px',
              background: '#1a3d2b',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Reload page
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

async function mountApp() {
  console.log('[Chapter99] React mounting…')

  const container = document.getElementById('root')
  if (!container) {
    throw new Error('#root element not found in index.html')
  }

  registerSW({
    immediate: true,
    onOfflineReady() {
      console.info('[PWA] App shell cached for offline use')
    },
    onNeedRefresh() {
      console.info('[PWA] New version available — refresh to update')
    },
  })

  const Root = (await import('./Root.tsx')).default

  createRoot(container).render(
    <StrictMode>
      <RootErrorBoundary>
        <Root />
      </RootErrorBoundary>
    </StrictMode>,
  )

  console.log('[Chapter99] React mount complete')
}

window.addEventListener('error', (event) => {
  console.error('[Chapter99] Uncaught error:', event.error ?? event.message)
})

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Chapter99] Unhandled promise rejection:', event.reason)
})

mountApp().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err)
  const stack = err instanceof Error ? err.stack : ''
  console.error('[Chapter99] Boot failed:', err)
  renderFatalError('Application failed to start', [message, stack].filter(Boolean).join('\n\n'))
})
