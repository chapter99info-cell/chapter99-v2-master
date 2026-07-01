import { useEffect, useState } from 'react'

const STORAGE_KEY = 'c99-accessible-mode'

export function useAccessibleMode() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    document.documentElement.classList.toggle('c99-accessible-mode', enabled)
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [enabled])

  return { enabled, toggle: () => setEnabled(v => !v) }
}

interface AccessibleModeToggleProps {
  shopPhone?: string
}

export function AccessibleModeToggle({ shopPhone }: AccessibleModeToggleProps) {
  const { enabled, toggle } = useAccessibleMode()
  const tel = shopPhone?.trim()

  return (
    <div className="accessible-mode-bar">
      {tel && (
        <a href={`tel:${tel.replace(/\s/g, '')}`} className="accessible-call-btn">
          CALL US TO BOOK — {tel}
        </a>
      )}
      <button type="button" className="accessible-toggle-btn" onClick={toggle} aria-pressed={enabled}>
        A+ {enabled ? 'On' : 'Off'}
      </button>
    </div>
  )
}
