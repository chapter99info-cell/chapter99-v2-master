import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Trip2TalkLogo from './Trip2TalkLogo'
import { ADMIN_PIN, setAdminSession } from '../lib/adminPinSession'

type PinLoginProps = {
  onUnlock?: () => void
}

export default function PinLogin({ onUnlock }: PinLoginProps) {
  const navigate = useNavigate()
  const [buffer, setBuffer] = useState('')
  const [shake, setShake] = useState(false)

  const tryPin = useCallback(
    (pin: string) => {
      if (pin === ADMIN_PIN) {
        setAdminSession()
        onUnlock?.()
        navigate('/admin/content-generator', { replace: true })
        return
      }
      setShake(true)
      setBuffer('')
      setTimeout(() => setShake(false), 450)
    },
    [navigate, onUnlock],
  )

  useEffect(() => {
    if (buffer.length < 4) return
    const pin = buffer
    setBuffer('')
    tryPin(pin)
  }, [buffer, tryPin])

  const pushDigit = (d: string) => {
    if (buffer.length >= 4) return
    setBuffer((b) => b + d)
  }

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0'] as const

  return (
    <div className="pin-login-root min-h-screen flex flex-col items-center justify-center p-6">
      <div className={`pin-login-panel w-full max-w-sm ${shake ? 'pin-login-shake' : ''}`}>
        <div className="text-center mb-10 flex flex-col items-center">
          <Trip2TalkLogo size="pin" className="mb-4" />
          <p className="pin-login-brand text-2xl font-bold tracking-[0.35em] text-white">TRIP2TALK</p>
          <p className="pin-login-sub mt-2 text-sm text-[#00d4d4] font-mono tracking-widest uppercase">
            Admin Access
          </p>
        </div>

        <div className="flex justify-center gap-4 mb-8">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`pin-login-dot h-4 w-4 rounded-full border-2 transition-all duration-150 ${
                buffer.length > i
                  ? 'border-[#00d4d4] bg-[#00d4d4] shadow-[0_0_12px_rgba(0,212,212,0.6)]'
                  : 'border-neutral-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
          {keys.map((key) => {
            if (key === 'CLR') {
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBuffer('')}
                  className="pin-login-key py-4 text-sm font-mono text-neutral-400"
                >
                  CLR
                </button>
              )
            }
            return (
              <button
                key={key}
                type="button"
                onClick={() => pushDigit(key)}
                className="pin-login-key py-4 text-xl font-mono text-white"
              >
                {key}
              </button>
            )
          })}
          <div aria-hidden className="pin-login-key opacity-0 pointer-events-none" />
        </div>
      </div>

      <style>{`
        .pin-login-root {
          background: #0a0a0a;
          color: #e8f4ff;
          font-family: ui-sans-serif, system-ui, sans-serif;
        }
        .pin-login-key {
          border-radius: 12px;
          border: 1px solid rgba(0, 212, 212, 0.2);
          background: rgba(15, 15, 15, 0.95);
          transition: transform 0.1s, box-shadow 0.15s;
        }
        .pin-login-key:active {
          transform: scale(0.96);
          box-shadow: 0 0 16px rgba(0, 212, 212, 0.15);
        }
        .pin-login-shake {
          animation: pin-shake 0.45s ease-in-out;
        }
        @keyframes pin-shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-10px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(8px); }
        }
      `}</style>
    </div>
  )
}
