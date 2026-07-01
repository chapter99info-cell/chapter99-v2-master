import { lazy, Suspense, type ComponentType } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import PublicLayout from './layouts/PublicLayout'
import PublicPageGuard from './components/routing/PublicPageGuard'
import ExternalOriginRedirect from './components/routing/ExternalOriginRedirect'
import ProductHead from './components/routing/ProductHead'
import OfflineBanner from './components/pwa/OfflineBanner'
import InstallPrompt from './components/pwa/InstallPrompt'
import {
  CHAPTER99_ORIGIN,
  getAppProduct,
  TRIP2TALK_ORIGIN,
  type AppProduct,
} from './lib/productDomain'

/** Chapter99 staff bundle is heavy — lazy-load so Trip2Talk /app can mount quickly */
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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-neutral-500 text-sm">
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

function Chapter99PublicRoutes() {
  return (
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
  )
}

function Trip2TalkRoutes() {
  return (
    <>
      <Route path="/spa" element={<Navigate to="/" replace />} />
      <Route path="/book" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/cancel" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/privacy" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/terms" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/voucher" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/about" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/services" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/menu" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="/chapter99/*" element={<ExternalOriginRedirect origin={CHAPTER99_ORIGIN} />} />
      <Route path="*" element={<App />} />
    </>
  )
}

function Chapter99Routes() {
  return (
    <>
      {Chapter99PublicRoutes()}
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
      <Route path="/shop-not-found" element={<LazyPage Page={ShopNotFoundPage} />} />
      <Route path="/onboard" element={<ExternalOriginRedirect origin={TRIP2TALK_ORIGIN} />} />
      <Route path="/app/*" element={<ExternalOriginRedirect origin={TRIP2TALK_ORIGIN} />} />
      <Route path="/staff/*" element={<ExternalOriginRedirect origin={TRIP2TALK_ORIGIN} />} />
      <Route path="/cashier/*" element={<ExternalOriginRedirect origin={TRIP2TALK_ORIGIN} />} />
      <Route path="/owner/*" element={<ExternalOriginRedirect origin={TRIP2TALK_ORIGIN} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </>
  )
}

/** Local / Vercel preview: both products (Trip2Talk PIN at /, Mira spa at /spa) */
function DevRoutes() {
  return (
    <>
      <Route element={<PublicLayout />}>
        <Route
          path="/spa"
          element={
            <PublicPageGuard page="home">
              <LazyPage Page={HomePage} />
            </PublicPageGuard>
          }
        />
        <Route path="/book" element={<LazyPage Page={BookPage} />} />
        <Route path="/cancel" element={<LazyPage Page={CancelBookingPage} />} />
        <Route path="/review/:bookingId" element={<LazyPage Page={ReviewPage} />} />
        <Route path="/privacy" element={<LazyPage Page={PrivacyPolicyPage} />} />
        <Route path="/terms" element={<LazyPage Page={TermsOfServicePage} />} />
        <Route
          path="/voucher"
          element={
            <PublicPageGuard page="vouchers">
              <LazyPage Page={PublicVoucherPage} />
            </PublicPageGuard>
          }
        />
        <Route
          path="/about"
          element={
            <PublicPageGuard page="about">
              <LazyPage Page={AboutPage} />
            </PublicPageGuard>
          }
        />
        <Route
          path="/services"
          element={
            <PublicPageGuard page="services">
              <LazyPage Page={PublicServicesPage} />
            </PublicPageGuard>
          }
        />
        <Route
          path="/menu"
          element={
            <PublicPageGuard page="services">
              <LazyPage Page={PublicMenuPage} />
            </PublicPageGuard>
          }
        />
      </Route>
      <Route
        path="/chapter99/staff/*"
        element={
          <Suspense fallback={<PageFallback />}>
            <Chapter99StaffApp />
          </Suspense>
        }
      />
      <Route path="*" element={<App />} />
    </>
  )
}

export default function Root() {
  const product = getAppProduct()

  return (
    <BrowserRouter>
      <ProductHead product={product} />
      <OfflineBanner />
      <Routes>
        {product === 'trip2talk' && Trip2TalkRoutes()}
        {product === 'chapter99' && Chapter99Routes()}
        {product === 'dev' && DevRoutes()}
      </Routes>
      <InstallPrompt />
    </BrowserRouter>
  )
}
