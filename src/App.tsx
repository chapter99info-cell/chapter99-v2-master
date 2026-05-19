// Chapter99 V4 — Main App Entry
// PIN-based routing to correct dashboard

import { useState, type Dispatch, type SetStateAction } from 'react'
import { createClient } from '@supabase/supabase-js'
import QueueBoard from './components/queue/QueueBoard'
import StaffManager from './components/staff/StaffManager'
import POSPage from './components/pos/POSPage'
import AlertDashboard from './components/alerts/AlertDashboard'
import SuperAdminDashboard from './components/dashboard/SuperAdminDashboard'
import BookingSystem from './components/booking/BookingSystem'

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

  async function verifyPIN() {
    if (pin.length !== 4) return
    setLoading(true)
    setError('')

    const { data } = await supabase.rpc('verify_pin', {
      p_shop_id: SHOP_ID,
      p_pin: pin,
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
  }

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
        <AppHeader title={`Good day, ${session.staffName ?? 'Staff'}!`} onLogout={logout} />
        <QueueBoard shopId={SHOP_ID} pinLevel="staff" staffId={session.staffId} />
      </div>
    )
  }

  // Cashier / Owner — full dashboard
  const tabs = [
    { id: 'queue', label: '📅 Queue' },
    { id: 'pos', label: '🧾 POS' },
    { id: 'booking', label: '➕ New Booking' },
    { id: 'alerts', label: '🔔 Alerts' },
    ...(session.level === 'owner' ? [{ id: 'staff', label: '👥 Staff' }] : []),
  ]

  return (
    <div className="app-root">
      <AppHeader
        title="Chapter99 Dashboard"
        badge={session.level === 'owner' ? 'Owner' : 'Cashier'}
        onLogout={logout}
      />
      <div className="app-tabs">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`app-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="app-content">
        {activeTab === 'queue' && (
          <QueueBoard shopId={SHOP_ID} pinLevel={session.level as any} />
        )}
        {activeTab === 'pos' && <POSPage />}
        {activeTab === 'booking' && (
          <BookingSystem shopId={SHOP_ID} mode="walkin" />
        )}
        {activeTab === 'alerts' && <AlertDashboard shopId={SHOP_ID} />}
        {activeTab === 'staff' && session.level === 'owner' && (
          <StaffManager shopId={SHOP_ID} pinLevel="owner" />
        )}
      </div>
    </div>
  )
}

// ── PIN Entry Screen ──────────────────────────────────────────
function PINScreen({ pin, setPin, onVerify, error, loading }: {
  pin: string
  setPin: Dispatch<SetStateAction<string>>
  onVerify: () => void
  error: string
  loading: boolean
}) {
  const numpad = ['1','2','3','4','5','6','7','8','9','','0','⌫']

  function press(key: string) {
    if (key === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (key === '') return
    if (pin.length < 4) setPin(p => p + key)
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
            onClick={() => { press(key); if (pin.length === 3 && key !== '⌫') setTimeout(onVerify, 100) }}
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

function AppHeader({ title, badge, onLogout }: {
  title: string; badge?: string; onLogout: () => void
}) {
  return (
    <div className="app-header">
      <div className="app-header-left">
        <span className="app-logo">Chapter99</span>
        {badge && <span className="app-badge">{badge}</span>}
        <span className="app-title">{title}</span>
      </div>
      <button className="logout-btn" onClick={onLogout}>Lock 🔒</button>
    </div>
  )
}

function LogoutBtn({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      style={{ position: 'fixed', top: 12, right: 16, fontSize: 12,
               padding: '4px 12px', borderRadius: 20, border: '0.5px solid #333',
               background: 'transparent', color: '#888', cursor: 'pointer' }}
      onClick={onLogout}
    >
      Lock 🔒
    </button>
  )
}
