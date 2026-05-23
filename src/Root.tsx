import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PublicVoucherPage from './pages/PublicVoucherPage'
import OfflineBanner from './components/pwa/OfflineBanner'
import InstallPrompt from './components/pwa/InstallPrompt'

export default function Root() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route path="/voucher" element={<PublicVoucherPage />} />
        <Route path="/*" element={<App />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  )
}
