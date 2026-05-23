import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PublicLayout from './layouts/PublicLayout'
import HomePage from './pages/HomePage'
import BookPage from './pages/BookPage'
import AboutPage from './pages/AboutPage'
import PublicServicesPage from './pages/PublicServicesPage'
import PublicVoucherPage from './pages/PublicVoucherPage'
import OfflineBanner from './components/pwa/OfflineBanner'
import InstallPrompt from './components/pwa/InstallPrompt'

export default function Root() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route index element={<HomePage />} />
          <Route path="book" element={<BookPage />} />
          <Route path="voucher" element={<PublicVoucherPage />} />
          <Route path="about" element={<AboutPage />} />
          <Route path="services" element={<PublicServicesPage />} />
        </Route>
        <Route path="/staff/*" element={<App />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  )
}
