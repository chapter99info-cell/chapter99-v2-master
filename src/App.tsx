// Chapter99 V4 — Main App Entry
// PIN-based routing to correct dashboard

import {
  useState,
  useCallback,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'
import { createClient } from '@supabase/supabase-js'
import { fetchShop } from './lib/shopService'
import { SHOP_UPDATED_EVENT } from './lib/shopLogo'
import QueueBoard from './components/queue/QueueBoard'
import StaffManager from './components/staff/StaffManager'
import ServicesManager from './components/services/ServicesManager'
import POSPage from './components/pos/POSPage'
import AlertDashboard from './components/alerts/AlertDashboard'
import SuperAdminDashboard from './components/dashboard/SuperAdminDashboard'
import BookingWizard from './components/booking/BookingWizard'
import ShopSettings from './components/settings/ShopSettings'
import RoomManager from './components/rooms/RoomManager'
import RevenueSummary from './components/dashboard/RevenueSummary'
import GiftVoucherList from './components/dashboard/GiftVoucherList'
import OwnerReports from './components/dashboard/OwnerReports'
import { countUnreadNotifications } from './lib/notificationService'
import { PlanProvider, usePlan } from './contexts/PlanContext'
import { PlanGatedTab, PlanGate } from './components/plan/PlanGatedTab'
import type { PlanFeature } from './types/plan'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Shop config — loaded from shop-XXX.json or Supabase
const SHOP_ID = import.meta.env.VITE_SHOP_ID ?? 'shop-001'

type PINLevel = 'staff' | 'cashier' | 'owner' | 'super_admin' | null

interface Session {
  level: PINLevel
  staffId?: string
  staffName?: string
}

export default function App() {
  const [session, setSession] = useState<Session>({ level: null })
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('queue')
  const [shopBranding, setShopBranding] = useState<{ name: string; logoUrl?: string } | null>(null)
  const [unreadAlerts, setUnreadAlerts] = useState(0)

  const loadShopBranding = useCallback(async () => {
    const shop = await fetchShop(SHOP_ID)
    setShopBranding({ name: shop.name, logoUrl: shop.logoUrl })
  }, [])

  useEffect(() => {
    if (!session.level || session.level === 'super_admin') return
    void loadShopBranding()
    const onUpdated = () => void loadShopBranding()
    window.addEventListener(SHOP_UPDATED_EVENT, onUpdated)
    return () => window.removeEventListener(SHOP_UPDATED_EVENT, onUpdated)
  }, [session.level, loadShopBranding])

  const refreshUnreadAlerts = useCallback(async () => {
    try {
      setUnreadAlerts(await countUnreadNotifications(supabase, SHOP_ID))
    } catch {
      setUnreadAlerts(0)
    }
  }, [])

  useEffect(() => {
    const level = session.level
    if (!level || level === 'staff' || level === 'super_admin') return

    void refreshUnreadAlerts()

    const channel = supabase
      .channel(`notifications-${SHOP_ID}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `shop_id=eq.${SHOP_ID}`,
        },
        () => { void refreshUnreadAlerts() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session.level, refreshUnreadAlerts])

  const verifyPIN = useCallback(async (pinToVerify: string) => {
    if (pinToVerify.length !== 4) return
    setLoading(true)
    setError('')

    const { data } = await supabase.rpc('verify_pin', {
      p_shop_id: SHOP_ID,
      p_pin: pinToVerify,
    })

    setLoading(false)

    if (data?.success) {
      setSession({
        level: data.level,
        staffId: data.staffId,
        staffName: data.staffName,
      })
      setPin('')
    } else {
      setError('Invalid PIN. Please try again.')
      setPin('')
    }
  }, [])

  function logout() {
    setSession({ level: null })
    setPin('')
    setError('')
  }

  // PIN Entry Screen
  if (!session.level) {
    return <PINScreen pin={pin} setPin={setPin} onVerify={verifyPIN} error={error} loading={loading} />
  }

  // Super Admin (PIN 3501)
  if (session.level === 'super_admin') {
    return (
      <div>
        <SuperAdminDashboard />
        <LogoutBtn onLogout={logout} />
      </div>
    )
  }

  // Staff View (PIN 1111) — only see own queue + briefing
  if (session.level === 'staff') {
    return (
      <div className="app-root">
        <AppHeader
          title={`Good day, ${session.staffName ?? 'Staff'}!`}
          shopName={shopBranding?.name}
          logoUrl={shopBranding?.logoUrl}
          onLogout={logout}
        />
        <QueueBoard shopId={SHOP_ID} pinLevel="staff" staffId={session.staffId} />
      </div>
    )
  }

  return (
    <PlanProvider shopId={SHOP_ID}>
      <StaffDashboard
        session={session}
        shopBranding={shopBranding}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        unreadAlerts={unreadAlerts}
        refreshUnreadAlerts={refreshUnreadAlerts}
        onLogout={logout}
      />
    </PlanProvider>
  )
}

type OwnerTabDef = { id: string; label: string; feature?: PlanFeature }

function StaffDashboard({
  session,
  shopBranding,
  activeTab,
  setActiveTab,
  unreadAlerts,
  refreshUnreadAlerts,
  onLogout,
}: {
  session: Session
  shopBranding: { name: string; logoUrl?: string } | null
  activeTab: string
  setActiveTab: (tab: string) => void
  unreadAlerts: number
  refreshUnreadAlerts: () => void
  onLogout: () => void
}) {
  const { planLabel } = usePlan()
  const isOwner = session.level === 'owner'

  const mainTabs = [
    { id: 'queue', label: '📅 Queue' },
    { id: 'pos', label: '🧾 POS' },
    { id: 'booking', label: '➕ New Booking' },
    { id: 'alerts', label: '🔔 Alerts' },
  ]

  const ownerTabs: OwnerTabDef[] = [
    { id: 'staff', label: '👥 Staff' },
    { id: 'services', label: '🛎 Services' },
    { id: 'rooms', label: '🚪 Rooms' },
    { id: 'vouchers', label: '🎁 Vouchers', feature: 'gift_vouchers' },
    { id: 'reports', label: '📊 Reports', feature: 'reports' },
    { id: 'website', label: '🌐 Website', feature: 'website_builder' },
    { id: 'settings', label: '⚙️ Settings' },
  ]

  return (
    <div className="app-root">
      <AppHeader
        title={shopBranding?.name ? `${shopBranding.name} Dashboard` : 'Chapter99 Dashboard'}
        shopName={shopBranding?.name}
        logoUrl={shopBranding?.logoUrl}
        badge={isOwner ? 'Owner' : 'Cashier'}
        planBadge={planLabel}
        onLogout={onLogout}
        extraTabs={
          <PlanGatedTab
            feature="multi_shop"
            label="🏢 Multi-shop"
            active={false}
            onSelect={() => undefined}
          />
        }
      />
      <div className="app-tabs">
        {mainTabs.map(t => (
          <div key={t.id} className="app-tab-wrap">
            <button
              type="button"
              className={`app-tab${activeTab === t.id ? ' active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              {t.label}
            </button>
            {t.id === 'alerts' && unreadAlerts > 0 && (
              <span className="app-tab-badge" aria-label={`${unreadAlerts} unread alerts`}>
                {unreadAlerts > 99 ? '99+' : unreadAlerts}
              </span>
            )}
          </div>
        ))}
      </div>
      {isOwner && (
        <div className="app-tabs app-tabs-owner">
          <span className="app-tabs-owner-label">Owner</span>
          {ownerTabs.map(t =>
            t.feature ? (
              <PlanGatedTab
                key={t.id}
                feature={t.feature}
                label={t.label}
                active={activeTab === t.id}
                onSelect={() => setActiveTab(t.id)}
              />
            ) : (
              <button
                key={t.id}
                type="button"
                className={`app-tab${activeTab === t.id ? ' active' : ''}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            )
          )}
        </div>
      )}
      <div className="app-content">
        {activeTab === 'queue' && (
          <>
            {isOwner && <RevenueSummary shopId={SHOP_ID} />}
            <QueueBoard shopId={SHOP_ID} pinLevel={session.level as any} />
          </>
        )}
        {activeTab === 'pos' && <POSPage />}
        {activeTab === 'booking' && (
          <BookingWizard shopId={SHOP_ID} bookedBy={session.staffName} />
        )}
        {activeTab === 'alerts' && (
          <AlertDashboard shopId={SHOP_ID} onMarkedRead={refreshUnreadAlerts} />
        )}
        {activeTab === 'staff' && isOwner && (
          <StaffManager shopId={SHOP_ID} pinLevel="owner" />
        )}
        {activeTab === 'services' && isOwner && (
          <ServicesManager shopId={SHOP_ID} />
        )}
        {activeTab === 'rooms' && isOwner && (
          <RoomManager shopId={SHOP_ID} />
        )}
        {activeTab === 'vouchers' && isOwner && (
          <PlanGate feature="gift_vouchers">
            <GiftVoucherList shopId={SHOP_ID} />
          </PlanGate>
        )}
        {activeTab === 'reports' && isOwner && (
          <PlanGate feature="reports">
            <OwnerReports shopId={SHOP_ID} />
          </PlanGate>
        )}
        {activeTab === 'website' && isOwner && (
          <PlanGate feature="website_builder">
            <div className="plan-gate-locked plan-website-placeholder">
              <h2>Website builder</h2>
              <p>
                Public site content and page visibility are managed by Chapter99 Super Admin.
                Contact us to publish or update your storefront.
              </p>
            </div>
          </PlanGate>
        )}
        {activeTab === 'settings' && isOwner && <ShopSettings shopId={SHOP_ID} />}
      </div>
    </div>
  )
}

// ── PIN Entry Screen ──────────────────────────────────────────
function PINScreen({ pin, setPin, onVerify, error, loading }: {
  pin: string
  setPin: Dispatch<SetStateAction<string>>
  onVerify: (pinToVerify: string) => void
  error: string
  loading: boolean
}) {
  const numpad = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  function press(key: string) {
    if (loading) return
    if (key === '⌫') {
      setPin(p => p.slice(0, -1))
      return
    }
    if (key === '' || pin.length >= 4) return

    const nextPin = pin + key
    setPin(nextPin)
    if (nextPin.length === 4) {
      onVerify(nextPin)
    }
  }

  return (
    <div className="pin-screen">
      <div className="pin-logo">Chapter99</div>
      <div className="pin-title">Enter PIN</div>

      {/* PIN dots */}
      <div className="pin-dots">
        {[0,1,2,3].map(i => (
          <div key={i} className={`pin-dot${i < pin.length ? ' filled' : ''}`} />
        ))}
      </div>

      {error && <div className="pin-error">{error}</div>}

      {/* Numpad */}
      <div className="numpad">
        {numpad.map((key, i) => (
          <button
            key={i}
            className={`numpad-btn${key === '' ? ' invisible' : ''}`}
            onClick={() => press(key)}
            disabled={loading}
          >
            {loading && key !== '⌫' ? '' : key}
          </button>
        ))}
      </div>

      <div className="pin-hint">
        Staff: 1111 · Cashier: 4444 · Owner: 9999
      </div>
    </div>
  )
}

function AppHeader({
  title,
  badge,
  planBadge,
  onLogout,
  logoUrl,
  shopName,
  extraTabs,
}: {
  title: string
  badge?: string
  planBadge?: string
  onLogout: () => void
  logoUrl?: string
  shopName?: string
  extraTabs?: ReactNode
}) {
  return (
    <div className="app-header">
      <div className="app-header-left">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={shopName ?? 'Shop logo'}
            className="app-header-logo"
          />
        ) : (
          <span className="app-logo">Chapter99</span>
        )}
        {badge && <span className="app-badge">{badge}</span>}
        {planBadge && <span className="app-plan-badge">{planBadge}</span>}
        <span className="app-title">{title}</span>
      </div>
      <div className="app-header-right">
        {extraTabs}
        <button type="button" className="logout-btn" onClick={onLogout}>
          Lock 🔒
        </button>
      </div>
    </div>
  )
}

function LogoutBtn({ onLogout }: { onLogout: () => void }) {
  return (
    <button type="button" className="super-admin-lock" onClick={onLogout}>
      Lock 🔒
    </button>
  )
}
