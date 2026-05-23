import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
)
