import { NavLink, Outlet } from 'react-router-dom'
import BookNowFab from '../components/BookNowFab'
import '../styles/client-luxury.css'
import '../pages/ClientApp.css'

const tabs = [
  { id: 'gallery', to: '/', label: 'GAL', sub: 'แกลเลอรี่', icon: '◎', end: true as const },
  { id: 'guide', to: '/guide', label: 'GUIDE', sub: 'ไกด์', icon: '▣' },
  { id: 'packing', to: '/packing', label: 'PACK', sub: 'จัดกระเป๋า', icon: '▤' },
  { id: 'trip', to: '/trip', label: 'TRIP', sub: 'ทริป', icon: '▲' },
  { id: 'staff', to: '/staff', label: 'STAFF', sub: 'ทีม', icon: '◆' },
]

export default function ClientAppLayout() {
  return (
    <div className="client-app-root client-neon mx-auto min-h-screen w-full max-w-md pb-24">
      <Outlet />
      <BookNowFab />
      <nav
        className="fixed bottom-0 left-0 right-0 z-50 border-t"
        style={{
          background: 'var(--color-surface, #141414)',
          borderColor: 'var(--color-border, #2a2520)',
        }}
        aria-label="Client app sections"
      >
        <div className="mx-auto flex max-w-md justify-between gap-0.5 px-1 py-2">
          {tabs.map((t) => (
            <NavLink
              key={t.id}
              to={t.to}
              end={t.end}
              className={({ isActive }) =>
                `relative flex min-w-[3.25rem] shrink-0 flex-col items-center rounded px-1.5 py-1.5 transition active:scale-95 ${
                  isActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span
                      className="absolute -top-0.5 left-2 right-2 h-0.5 rounded-full"
                      style={{ background: 'var(--color-accent, #c9a84c)' }}
                      aria-hidden
                    />
                  )}
                  <span className="text-sm leading-none">{t.icon}</span>
                  <span className="mt-0.5 text-[8px] font-bold tracking-widest">{t.label}</span>
                  <span
                    className="mt-0.5 text-[7px] leading-none"
                    style={{ color: 'var(--color-text-muted, #8a8070)' }}
                  >
                    {t.sub}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
