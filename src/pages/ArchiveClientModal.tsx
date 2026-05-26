import { useCallback, useState } from 'react'
import { archiveAndDeleteClient } from '../lib/clientArchive'
import { T2Button, T2Card } from '../components/trip2talk/Trip2TalkShell'
import type { ArchiveProgressStep } from '../types/archive'
import type { CRMClient, Tour, TourBooking } from '../types/tour'

type Phase = 'confirm' | 'processing' | 'success' | 'error'

export interface ArchiveClientModalProps {
  client: CRMClient
  booking: TourBooking
  tour: Tour
  staffId: string
  onSuccess: () => void
  onClose: () => void
}

const STEP_LABELS: Record<ArchiveProgressStep['id'], string> = {
  fetch: 'Fetching client records',
  archive: 'Archiving to Google Sheets',
  delete: 'Removing from database',
}

function initialSteps(): ArchiveProgressStep[] {
  return [
    { id: 'fetch', label: STEP_LABELS.fetch, status: 'pending' },
    { id: 'archive', label: STEP_LABELS.archive, status: 'pending' },
    { id: 'delete', label: STEP_LABELS.delete, status: 'pending' },
  ]
}

export default function ArchiveClientModal({
  client,
  booking,
  tour,
  staffId,
  onSuccess,
  onClose,
}: ArchiveClientModalProps) {
  const [phase, setPhase] = useState<Phase>('confirm')
  const [codeInput, setCodeInput] = useState('')
  const [steps, setSteps] = useState<ArchiveProgressStep[]>(initialSteps)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const clientName = `${client.first_name_en} ${client.last_name_en}`.trim()
  const codeMatch =
    codeInput.trim().toUpperCase() === tour.trip_code.trim().toUpperCase()

  const setStageActive = useCallback((stage: ArchiveProgressStep['id']) => {
    const order: ArchiveProgressStep['id'][] = ['fetch', 'archive', 'delete']
    const idx = order.indexOf(stage)
    setSteps(
      order.map((id, i) => ({
        id,
        label: STEP_LABELS[id],
        status: i < idx ? 'done' : i === idx ? 'active' : 'pending',
      }))
    )
  }, [])

  const runArchive = useCallback(async () => {
    setPhase('processing')
    setSteps(initialSteps())
    setErrorMessage(null)
    setStageActive('fetch')

    try {
      await archiveAndDeleteClient(
        client.id,
        tour.id,
        staffId,
        'TRIP_COMPLETED',
        (stage) => setStageActive(stage)
      )
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'done' as const })))
      setPhase('success')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Archive failed'
      setErrorMessage(msg)
      setSteps((prev) =>
        prev.map((s) =>
          s.status === 'active' ? { ...s, status: 'error' as const } : s
        )
      )
      setPhase('error')
    }
  }, [client.id, tour.id, staffId, setStageActive])

  function handleConfirm() {
    if (!codeMatch) return
    void runArchive()
  }

  function handleRetry() {
    setCodeInput('')
    setPhase('confirm')
    setSteps(initialSteps())
    setErrorMessage(null)
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/70 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-modal-title"
    >
      <div
        className={`w-full max-w-md rounded-2xl border bg-neutral-900 shadow-2xl transition-shadow ${
          phase === 'confirm' || phase === 'error'
            ? 'border-red-900/60 shadow-[0_0_40px_rgba(220,38,38,0.2)]'
            : phase === 'success'
              ? 'border-emerald-800/60 shadow-[0_0_40px_rgba(16,185,129,0.2)]'
              : 'border-neutral-800'
        }`}
      >
        <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-3">
          <h2 id="archive-modal-title" className="text-sm font-semibold text-neutral-100">
            Archive client
          </h2>
          {phase !== 'processing' && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-neutral-500 transition hover:text-neutral-300 active:scale-95"
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-4">
          {phase === 'confirm' && (
            <ConfirmPhase
              clientName={clientName}
              tripCode={tour.trip_code}
              destination={tour.destination}
              codeInput={codeInput}
              codeMatch={codeMatch}
              onCodeChange={setCodeInput}
              onConfirm={handleConfirm}
              onClose={onClose}
            />
          )}

          {phase === 'processing' && (
            <ProcessingPhase steps={steps} clientName={clientName} />
          )}

          {phase === 'success' && (
            <SuccessPhase
              clientName={clientName}
              tripCode={tour.trip_code}
              onDone={() => {
                onSuccess()
                onClose()
              }}
            />
          )}

          {phase === 'error' && (
            <ErrorPhase
              message={errorMessage}
              steps={steps}
              onRetry={handleRetry}
              onClose={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ConfirmPhase({
  clientName,
  tripCode,
  destination,
  codeInput,
  codeMatch,
  onCodeChange,
  onConfirm,
  onClose,
}: {
  clientName: string
  tripCode: string
  destination: string
  codeInput: string
  codeMatch: boolean
  onCodeChange: (v: string) => void
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-3 py-3">
        <p className="text-sm font-medium text-red-300">Permanent action</p>
        <p className="mt-1 text-xs text-red-200/80">
          This archives the client to Google Sheets and permanently deletes their
          profile, booking, waivers, and reviews from Supabase. This cannot be undone.
        </p>
      </div>

      <T2Card className="!p-3">
        <p className="text-xs text-neutral-500">Client</p>
        <p className="font-medium text-neutral-100">{clientName}</p>
        <p className="mt-2 font-mono text-xs text-amber-400">{tripCode}</p>
        <p className="text-sm text-neutral-400">{destination}</p>
      </T2Card>

      <div>
        <label
          htmlFor="archive-trip-code"
          className="mb-2 block text-xs font-medium text-neutral-400"
        >
          Type trip code <span className="font-mono text-amber-400">{tripCode}</span> to confirm
        </label>
        <input
          id="archive-trip-code"
          type="text"
          value={codeInput}
          onChange={(e) => onCodeChange(e.target.value)}
          placeholder={tripCode}
          autoComplete="off"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-950 px-4 py-3 font-mono text-sm uppercase text-neutral-100 outline-none transition focus:border-red-500/60 focus:ring-1 focus:ring-red-500/30"
        />
      </div>

      <T2Button variant="danger" disabled={!codeMatch} onClick={onConfirm}>
        Archive & delete permanently
      </T2Button>
      <T2Button variant="ghost" onClick={onClose}>
        Cancel
      </T2Button>
    </div>
  )
}

function ProcessingPhase({
  steps,
  clientName,
}: {
  steps: ArchiveProgressStep[]
  clientName: string
}) {
  return (
    <div className="space-y-4">
      <p className="text-center text-sm text-neutral-400">
        Archiving <span className="text-neutral-200">{clientName}</span>…
      </p>
      <ul className="space-y-3">
        {steps.map((step) => (
          <li
            key={step.id}
            className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition ${
              step.status === 'active'
                ? 'border-amber-500/40 bg-amber-500/5'
                : step.status === 'done'
                  ? 'border-emerald-900/40 bg-emerald-950/20'
                  : step.status === 'error'
                    ? 'border-red-900/50 bg-red-950/20'
                    : 'border-neutral-800 bg-neutral-950/50'
            }`}
          >
            <StepIcon status={step.status} />
            <span
              className={`text-sm ${
                step.status === 'active'
                  ? 'text-amber-400'
                  : step.status === 'done'
                    ? 'text-emerald-400'
                    : step.status === 'error'
                      ? 'text-red-400'
                      : 'text-neutral-500'
              }`}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ul>
      <p className="text-center text-xs text-neutral-600">Do not close this window.</p>
    </div>
  )
}

function StepIcon({ status }: { status: ArchiveProgressStep['status'] }) {
  if (status === 'done') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600/30 text-xs text-emerald-400">
        ✓
      </span>
    )
  }
  if (status === 'error') {
    return (
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600/30 text-xs text-red-400">
        !
      </span>
    )
  }
  if (status === 'active') {
    return (
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" />
    )
  }
  return (
    <span className="h-6 w-6 rounded-full border border-neutral-700" />
  )
}

function SuccessPhase({
  clientName,
  tripCode,
  onDone,
}: {
  clientName: string
  tripCode: string
  onDone: () => void
}) {
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-3xl text-emerald-400 shadow-[0_0_32px_rgba(16,185,129,0.35)]">
        ✓
      </div>
      <h3 className="text-lg font-semibold text-neutral-50">Archive complete</h3>
      <p className="text-sm text-neutral-400">
        <span className="text-neutral-200">{clientName}</span> has been archived for{' '}
        <span className="font-mono text-amber-400">{tripCode}</span> and removed from the app.
      </p>
      <T2Button onClick={onDone}>Done</T2Button>
    </div>
  )
}

function ErrorPhase({
  message,
  steps,
  onRetry,
  onClose,
}: {
  message: string | null
  steps: ArchiveProgressStep[]
  onRetry: () => void
  onClose: () => void
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-red-900/60 bg-red-950/40 px-3 py-3 shadow-[inset_0_0_20px_rgba(220,38,38,0.15)]">
        <p className="text-sm font-medium text-red-300">Archive failed</p>
        <p className="mt-1 text-xs text-red-200/90">
          {message ?? 'Something went wrong. You can retry or cancel.'}
        </p>
      </div>

      <ul className="space-y-2">
        {steps.map((step) => (
          <li
            key={step.id}
            className="flex items-center gap-2 text-xs text-neutral-500"
          >
            <StepIcon status={step.status} />
            {step.label}
          </li>
        ))}
      </ul>

      <T2Button variant="danger" onClick={onRetry}>
        Retry
      </T2Button>
      <T2Button variant="ghost" onClick={onClose}>
        Close
      </T2Button>
    </div>
  )
}
