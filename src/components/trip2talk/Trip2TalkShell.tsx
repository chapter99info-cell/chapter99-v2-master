import type { ReactNode } from 'react'

export default function Trip2TalkShell({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`min-h-screen font-sans ${className}`}
      style={{ background: 'var(--color-bg, #0a0a0a)', color: 'var(--color-text, #f5f0e8)' }}
    >
      <div className="mx-auto w-full max-w-md min-h-screen">{children}</div>
    </div>
  )
}

export function T2Card({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border p-4 shadow-lg ${className}`}
      style={{
        borderColor: 'var(--color-border, #2a2520)',
        background: 'var(--color-surface, #141414)',
      }}
    >
      {children}
    </div>
  )
}

export function T2Button({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  variant?: 'primary' | 'ghost' | 'danger'
  className?: string
  type?: 'button' | 'submit'
}) {
  const base =
    'w-full rounded-xl px-4 py-3 font-medium transition active:scale-95 disabled:opacity-50 disabled:active:scale-100'
  const styles =
    variant === 'primary'
      ? 'bg-[#C9A84C] text-[#0a0a0a] hover:bg-[#E8C96A]'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-500'
        : 'border text-[var(--color-text)] hover:border-[#C9A84C]/50'
  const ghostStyle =
    variant === 'ghost'
      ? { borderColor: 'var(--color-border, #2a2520)', background: 'var(--color-surface, #141414)' }
      : undefined

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`${base} ${styles} ${className}`}
      style={ghostStyle}
    >
      {children}
    </button>
  )
}

export function SkeletonCard() {
  return <div className="h-28 animate-pulse rounded-2xl bg-neutral-800/80" />
}
