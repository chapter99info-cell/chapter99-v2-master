import { formatAUD } from '../../lib/payidCalc'

interface StaffPaymentAlertsProps {
  pushSupported: boolean
  vapidConfigured: boolean
  pushPermission: NotificationPermission
  pushRegistering: boolean
  pushError: string | null
  onEnablePush: () => void
  lastPayment: {
    client_name: string
    trip_code: string
    amount_aud: number
    payment_method: string
    reference_number: string
  } | null
  fbPostText: string
  fbCopied: boolean
  onCopyFb: () => void
  onDismiss: () => void
}

export default function StaffPaymentAlerts({
  pushSupported,
  vapidConfigured,
  pushPermission,
  pushRegistering,
  pushError,
  onEnablePush,
  lastPayment,
  fbPostText,
  fbCopied,
  onCopyFb,
  onDismiss,
}: StaffPaymentAlertsProps) {
  const showEnable =
    pushSupported && vapidConfigured && pushPermission !== 'granted'

  return (
    <div className="space-y-3">
      {showEnable && (
        <div className="staff-terminal__panel p-4 border-cyan-500/30">
          <p className="text-xs font-semibold text-cyan-400 uppercase tracking-wider">
            Payment alerts (Web Push · free)
          </p>
          <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
            Get notified when Cashier records a payment — then copy the FB post below (~30s).
          </p>
          <button
            type="button"
            onClick={onEnablePush}
            disabled={pushRegistering}
            className="mt-3 w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
          >
            {pushRegistering ? 'Enabling…' : 'Enable push notifications'}
          </button>
        </div>
      )}

      {!vapidConfigured && pushSupported && (
        <p className="text-xs text-amber-500/90 font-mono px-1">
          Set VITE_VAPID_PUBLIC_KEY + Supabase VAPID secrets to enable push.
        </p>
      )}

      {pushPermission === 'granted' && !lastPayment && (
        <p className="text-xs text-emerald-500/80 font-mono px-1">
          ✓ Push alerts on · waiting for next payment
        </p>
      )}

      {pushError && (
        <p className="text-xs text-red-400 px-1">{pushError}</p>
      )}

      {lastPayment && (
        <div className="staff-terminal__panel p-4 border-emerald-500/35 shadow-[0_0_24px_rgba(57,255,20,0.12)]">
          <div className="flex justify-between items-start gap-2">
            <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
              💳 New payment
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="text-neutral-500 text-xs hover:text-neutral-300"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
          <p className="text-sm text-neutral-100 mt-2">
            {lastPayment.client_name} · {formatAUD(lastPayment.amount_aud)}
          </p>
          <p className="text-xs text-neutral-500 font-mono mt-0.5">
            {lastPayment.trip_code} · {lastPayment.payment_method}
          </p>

          <p className="staff-terminal__th mt-4 mb-2 text-[#ff2d95]">
            FB GROUP POST (manual ~30s)
          </p>
          <textarea
            readOnly
            value={fbPostText}
            rows={10}
            className="w-full text-xs font-mono bg-neutral-950 border border-neutral-700 rounded-lg p-2 text-neutral-300 resize-none"
          />
          <button
            type="button"
            onClick={onCopyFb}
            className="mt-2 w-full py-2 rounded-lg text-xs font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-400 border border-emerald-500/40"
          >
            {fbCopied ? 'Copied ✓' : 'Copy for Facebook'}
          </button>
        </div>
      )}
    </div>
  )
}
