import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import ClientAppLayout from './layouts/ClientAppLayout'
import PreTripOnboarding from './pages/PreTripOnboarding'
import ClientApp from './pages/ClientApp'
import PackingGuide from './pages/PackingGuide'
import TripDashboard from './pages/TripDashboard'
import PhotoFeedFull from './pages/PhotoFeedFull.jsx'
import ContentGeneratorPage from './pages/admin/content-generator'
import Trip2TalkLogo from './components/Trip2TalkLogo'
import type { StaffRole } from './types/tour'

import StaffDashboard from './pages/StaffDashboard'

const CashierPOS = lazy(() => import('./pages/CashierPOS'))
const OwnerDashboard = lazy(() => import('./pages/OwnerDashboard'))

const PIN_GUIDE = '1111'
const PIN_CASHIER = '4444'
const PIN_OWNER = '9999'
const MAX_ATTEMPTS = 3
const LOCKOUT_MS = 30_000
const IDLE_MS = 30 * 60 * 1000

const PIN_TO_ROLE: Record<string, StaffRole> = {
  [PIN_GUIDE]: 'GUIDE',
  [PIN_CASHIER]: 'CASHIER',
  [PIN_OWNER]: 'OWNER',
}

const ROLE_HOME: Record<StaffRole, string> = {
  GUIDE: '/staff',
  CASHIER: '/cashier',
  OWNER: '/owner',
  MANAGER: '/owner',
}

const STAFF_ROLE_STORAGE_KEY = 't2t_staff_role'

function readStoredStaffRole(): StaffRole | null {
  try {
    const raw = sessionStorage.getItem(STAFF_ROLE_STORAGE_KEY)
    if (raw === 'GUIDE' || raw === 'CASHIER' || raw === 'OWNER' || raw === 'MANAGER') {
      return raw
    }
  } catch {
    /* private browsing */
  }
  return null
}

function persistStaffRole(role: StaffRole | null) {
  try {
    if (role) sessionStorage.setItem(STAFF_ROLE_STORAGE_KEY, role)
    else sessionStorage.removeItem(STAFF_ROLE_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

class StaffShellErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-center">
          <p className="text-amber-400 font-semibold mb-2">Staff screen failed to load</p>
          <p className="text-red-400 text-sm max-w-sm mb-4">{this.state.error}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

function PinScreen({ onUnlock }: { onUnlock: (role: StaffRole) => void }) {
  const [buffer, setBuffer] = useState('')
  const [attempts, setAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [lockSeconds, setLockSeconds] = useState(0)
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (!lockedUntil) return
    const tick = () => {
      const left = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000))
      setLockSeconds(left)
      if (left <= 0) setLockedUntil(null)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [lockedUntil])

  const locked = lockedUntil !== null && Date.now() < lockedUntil

  const tryPin = useCallback(
    (pin: string) => {
      const role = PIN_TO_ROLE[pin]
      if (role) {
        setAttempts(0)
        onUnlock(role)
        return
      }
      const next = attempts + 1
      setAttempts(next)
      setShake(true)
      setTimeout(() => setShake(false), 400)
      if (next >= MAX_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS)
        setAttempts(0)
      }
    },
    [attempts, onUnlock]
  )

  useEffect(() => {
    if (buffer.length < 4 || locked) return
    const pin = buffer
    setBuffer('')
    tryPin(pin)
  }, [buffer, locked, tryPin])

  const pushDigit = (d: string) => {
    if (locked || buffer.length >= 4) return
    setBuffer((b) => b + d)
  }

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center">
          <Trip2TalkLogo size="pin" className="mb-4" />
          <h1 className="text-center text-2xl font-semibold text-amber-400 tracking-wide">
            TRIP2TALK
          </h1>
        </div>
        <p className="text-center text-neutral-500 text-sm mt-2">Operator access</p>

        <div
          className={`mt-10 flex justify-center gap-4 ${shake ? 'animate-[shake_0.4s_ease-in-out]' : ''}`}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`h-3 w-3 rounded-full border-2 transition-colors ${
                buffer.length > i ? 'border-amber-400 bg-amber-400' : 'border-neutral-600'
              }`}
            />
          ))}
        </div>

        {locked ? (
          <p className="mt-4 text-center text-red-400 font-mono text-sm">
            Locked · {lockSeconds}s
          </p>
        ) : attempts > 0 ? (
          <p className="mt-4 text-center text-orange-400 text-sm">
            Invalid · {MAX_ATTEMPTS - attempts} left
          </p>
        ) : (
          <p className="mt-4 text-center text-neutral-500 text-sm">Enter 4-digit PIN</p>
        )}

        <div className="mt-8 grid grid-cols-3 gap-3 max-w-xs mx-auto">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
            <button
              key={d}
              type="button"
              disabled={locked}
              onClick={() => pushDigit(d)}
              className="rounded-xl border border-neutral-800 bg-neutral-900 py-4 text-lg font-mono text-neutral-100 active:scale-95 disabled:opacity-40"
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            disabled={locked}
            onClick={() => setBuffer('')}
            className="rounded-xl border border-neutral-800 bg-neutral-900 py-4 text-sm text-neutral-500 active:scale-95"
          >
            CLR
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => pushDigit('0')}
            className="rounded-xl border border-neutral-800 bg-neutral-900 py-4 text-lg font-mono active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => setBuffer((b) => b.slice(0, -1))}
            className="rounded-xl border border-neutral-800 bg-neutral-900 py-4 text-lg text-amber-400 active:scale-95"
            aria-label="Backspace"
          >
            *
          </button>
        </div>
      </div>
    </div>
  )
}

const STAFF_ENTRY_PATHS = ['/staff', '/cashier', '/owner'] as const

function isStaffEntryPath(pathname: string): boolean {
  return STAFF_ENTRY_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

/** Staff-only PIN gate — /staff, /cashier, /owner only (not public /) */
function StaffPinShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const [role, setRoleState] = useState<StaffRole | null>(() => readStoredStaffRole())

  const setRole = useCallback((next: StaffRole | null) => {
    setRoleState(next)
    persistStaffRole(next)
  }, [])

  useEffect(() => {
    if (!role) return
    const resetIdle = () => {
      window.__t2Idle = Date.now()
    }
    window.__t2Idle = Date.now()
    const events = ['pointerdown', 'keydown', 'scroll', 'touchstart'] as const
    events.forEach((e) => window.addEventListener(e, resetIdle))
    const id = setInterval(() => {
      if (Date.now() - (window.__t2Idle ?? 0) > IDLE_MS) {
        setRole(null)
        navigate('/', { replace: true })
      }
    }, 60_000)
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle))
      clearInterval(id)
    }
  }, [role, navigate, setRole])

  const handleLogout = useCallback(() => {
    setRole(null)
    navigate('/', { replace: true })
  }, [navigate, setRole])

  const handleUnlock = useCallback(
    (r: StaffRole) => {
      setRole(r)
      navigate(ROLE_HOME[r], { replace: true })
    },
    [navigate, setRole],
  )

  const home = role ? ROLE_HOME[role] : null
  const onHome =
    Boolean(home) &&
    (location.pathname === home || location.pathname.startsWith(`${home}/`))

  useEffect(() => {
    if (!role || !home || onHome) return
    navigate(home, { replace: true })
  }, [role, home, onHome, navigate])

  if (!role) {
    if (!isStaffEntryPath(location.pathname)) {
      return <Navigate to="/staff" replace />
    }
    return <PinScreen onUnlock={handleUnlock} />
  }

  let screen: ReactNode = null
  if (role === 'GUIDE') {
    screen = <StaffDashboard onLogout={handleLogout} />
  } else if (role === 'CASHIER') {
    screen = <CashierPOS onLogout={handleLogout} />
  } else if (role === 'OWNER' || role === 'MANAGER') {
    screen = <OwnerDashboard onLogout={handleLogout} />
  }

  if (!onHome) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-amber-400">
        Loading…
      </div>
    )
  }

  return (
    <StaffShellErrorBoundary>
      <Suspense
        fallback={
          <div className="min-h-screen bg-neutral-950 flex items-center justify-center text-amber-400">
            Loading…
          </div>
        }
      >
        {screen}
      </Suspense>
    </StaffShellErrorBoundary>
  )
}

/** Legacy /app/* bookmarks → same path without /app prefix */
function LegacyAppRedirect() {
  const { pathname } = useLocation()
  const target = pathname.replace(/^\/app\/?/, '') || '/'
  return <Navigate to={target.startsWith('/') ? target : `/${target}`} replace />
}

/**
 * Trip2Talk router — / is public client app; /staff|/cashier|/owner are PIN-gated.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<ContentGeneratorPage />} />
      <Route path="/admin/content-generator" element={<ContentGeneratorPage />} />
      <Route path="/onboard" element={<PreTripOnboarding />} />

      <Route path="/" element={<ClientAppLayout />}>
        <Route index element={<PhotoFeedFull />} />
        <Route path="guide" element={<ClientApp />} />
        <Route path="gallery" element={<Navigate to="/" replace />} />
        <Route path="book" element={<Navigate to="/" replace />} />
        <Route path="social" element={<Navigate to="/" replace />} />
        <Route path="packing" element={<PackingGuide />} />
        <Route path="trip" element={<TripDashboard />} />
      </Route>

      <Route path="/app" element={<Navigate to="/" replace />} />
      <Route path="/app/*" element={<LegacyAppRedirect />} />

      <Route path="/staff" element={<StaffPinShell />} />
      <Route path="/staff/*" element={<StaffPinShell />} />
      <Route path="/cashier" element={<StaffPinShell />} />
      <Route path="/cashier/*" element={<StaffPinShell />} />
      <Route path="/owner" element={<StaffPinShell />} />
      <Route path="/owner/*" element={<StaffPinShell />} />
    </Routes>
  )
}

declare global {
  interface Window {
    __t2Idle?: number
  }
}
