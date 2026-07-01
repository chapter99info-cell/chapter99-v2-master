import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import PublicLayout from './layouts/PublicLayout'
import PublicPageGuard from './components/routing/PublicPageGuard'
import ProductHead from './components/routing/ProductHead'
import OfflineBanner from './components/pwa/OfflineBanner'
import InstallPrompt from './components/pwa/InstallPrompt'

const Chapter99StaffApp = lazy(() => import('./Chapter99StaffApp'))
const HomePage = lazy(() => import('./pages/HomePage'))
const BookPage = lazy(() => import('./pages/BookPage'))
const AboutPage = lazy(() => import('./pages/AboutPage'))
const PublicServicesPage = lazy(() => import('./pages/PublicServicesPage'))
const PublicMenuPage = lazy(() => import('./pages/PublicMenuPage'))
const PublicVoucherPage = lazy(() => import('./pages/PublicVoucherPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const CancelBookingPage = lazy(() => import('./pages/CancelBookingPage'))
const ReviewPage = lazy(() => import('./pages/ReviewPage'))
const ShopNotFoundPage = lazy(() => import('./pages/ShopNotFoundPage'))

function PageFallback() {
  return (
    <div className="min-h-screen bg-[#F8F5F0] flex items-center justify-center text-[#6B7280] text-sm">
      Loading…
    </div>
  )
}

function LazyPage({ Page }: { Page: ComponentType }) {
  return (
    <Suspense fallback={<PageFallback />}>
      <Page />
    </Suspense>
  )
}

export default function Root() {
  return (
    <BrowserRouter>
      <ProductHead />
      <OfflineBanner />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route
            index
            element={
              <PublicPageGuard page="home">
                <LazyPage Page={HomePage} />
              </PublicPageGuard>
            }
          />
          <Route path="book" element={<LazyPage Page={BookPage} />} />
          <Route path="cancel" element={<LazyPage Page={CancelBookingPage} />} />
          <Route path="review/:bookingId" element={<LazyPage Page={ReviewPage} />} />
          <Route path="privacy" element={<LazyPage Page={PrivacyPolicyPage} />} />
          <Route path="terms" element={<LazyPage Page={TermsOfServicePage} />} />
          <Route
            path="voucher"
            element={
              <PublicPageGuard page="vouchers">
                <LazyPage Page={PublicVoucherPage} />
              </PublicPageGuard>
            }
          />
          <Route
            path="about"
            element={
              <PublicPageGuard page="about">
                <LazyPage Page={AboutPage} />
              </PublicPageGuard>
            }
          />
          <Route
            path="services"
            element={
              <PublicPageGuard page="services">
                <LazyPage Page={PublicServicesPage} />
              </PublicPageGuard>
            }
          />
          <Route
            path="menu"
            element={
              <PublicPageGuard page="services">
                <LazyPage Page={PublicMenuPage} />
              </PublicPageGuard>
            }
          />
        </Route>
        <Route path="/shop-not-found" element={<LazyPage Page={ShopNotFoundPage} />} />
        <Route path="/spa" element={<Navigate to="/" replace />} />
        <Route
          path="/chapter99/staff/*"
          element={
            <Suspense fallback={<PageFallback />}>
              <Chapter99StaffApp />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  )
}
