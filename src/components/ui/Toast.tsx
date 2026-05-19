import { useEffect } from 'react'
import './Toast.css'

export type ToastType = 'success' | 'error'

interface ToastProps {
  message: string
  type?: ToastType
  onClose: () => void
  durationMs?: number
}

export default function Toast({
  message,
  type = 'success',
  onClose,
  durationMs = 3500,
}: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onClose, durationMs)
    return () => window.clearTimeout(id)
  }, [message, durationMs, onClose])

  return (
    <div className={`app-toast app-toast-${type}`} role="status" aria-live="polite">
      {message}
    </div>
  )
}
