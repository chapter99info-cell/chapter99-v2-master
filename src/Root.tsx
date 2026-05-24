import { BrowserRouter, Routes, Route } from 'react-router-dom'
import App from './App'
import PublicLayout from './layouts/PublicLayout'
import HomePage from './pages/HomePage'
import BookPage from './pages/BookPage'
import AboutPage from './pages/AboutPage'
import PublicServicesPage from './pages/PublicServicesPage'
import PublicMenuPage from './pages/PublicMenuPage'
import PublicVoucherPage from './pages/PublicVoucherPage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsOfServicePage from './pages/TermsOfServicePage'
import CancelBookingPage from './pages/CancelBookingPage'
import PublicPageGuard from './components/routing/PublicPageGuard'
import OfflineBanner from './components/pwa/OfflineBanner'
import InstallPrompt from './components/pwa/InstallPrompt'

export default function Root() {
  return (
    <BrowserRouter>
      <OfflineBanner />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route
            index
            element={
              <PublicPageGuard page="home">
                <HomePage />
              </PublicPageGuard>
            }
          />
          <Route path="book" element={<BookPage />} />
          <Route path="cancel" element={<CancelBookingPage />} />
          <Route path="privacy" element={<PrivacyPolicyPage />} />
          <Route path="terms" element={<TermsOfServicePage />} />
          <Route
            path="voucher"
            element={
              <PublicPageGuard page="vouchers">
                <PublicVoucherPage />
              </PublicPageGuard>
            }
          />
          <Route
            path="about"
            element={
              <PublicPageGuard page="about">
                <AboutPage />
              </PublicPageGuard>
            }
          />
          <Route
            path="services"
            element={
              <PublicPageGuard page="services">
                <PublicServicesPage />
              </PublicPageGuard>
            }
          />
          <Route
            path="menu"
            element={
              <PublicPageGuard page="services">
                <PublicMenuPage />
              </PublicPageGuard>
            }
          />
        </Route>
        <Route path="/staff/*" element={<App />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  )
}
