import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import type { ATOCategory, BookingStatus, CRMClient, Expense, Tour, TourBookingWithClient } from '../types/tour'
import { supabase } from '../lib/supabase'
import { dispatchTransactionNotification } from '../lib/notifications'
import { saveExpenseLocally } from '../lib/expenseDb'
import { syncExpenseToGoogleWorkspace } from '../lib/googleSync'
import { formatAUD, generateReceiptFilename, sydneyTodayStartIso } from '../lib/payidCalc'
import { filterAllowedTours } from '../lib/tripFilters'
import './CashierPOS.css'

type Tab = 'PAYMENT' | 'EXPENSE' | 'HISTORY'
type PaymentMethod = 'PAYID' | 'BANK TRANSFER' | 'CASH' | 'CARD'

const PAYMENT_METHODS: PaymentMethod[] = ['PAYID', 'BANK TRANSFER', 'CASH', 'CARD']
const ATO_CATEGORIES: ATOCategory[] = [
  'Transport',
  'Accommodation',
  'Meals',
  'Attractions',
  'Marketing',
  'Insurance',
  'Other',
]
const ACTIVE_STATUSES = ['CONFIRMED', 'ACTIVE'] as const

const TAB_LABELS: Record<Tab, string> = {
  PAYMENT: '💳 PAYMENT',
  EXPENSE: '🧾 EXPENSE',
  HISTORY: '📋 HISTORY',
}

function clientFullName(c: CRMClient): string {
  return `${c.first_name_en} ${c.last_name_en}`.trim() || `${c.first_name_th} ${c.last_name_th}`
}

function clientThaiName(c: { first_name_th?: string; last_name_th?: string } | null): string {
  if (!c) return '—'
  return `${c.first_name_th ?? ''} ${c.last_name_th ?? ''}`.trim() || '—'
}

function matchesSearch(client: CRMClient, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const en = clientFullName(client).toLowerCase()
  const th = `${client.first_name_th} ${client.last_name_th}`.toLowerCase()
  return en.includes(q) || th.includes(q) || client.passport_number.toLowerCase().includes(q)
}

function LiveClock() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const time = now.toLocaleTimeString('en-AU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Australia/Sydney',
  })
  const date = now.toLocaleDateString('en-AU', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    timeZone: 'Australia/Sydney',
  })

  return (
    <div className="cashier-neon__clock cashier-neon__mono">
      <div>{time}</div>
      <div>{date}</div>
    </div>
  )
}

interface SuccessModalProps {
  title: string
  lines: { label: string; value: string }[]
  onClose: () => void
}

function SuccessModal({ title, lines, onClose }: SuccessModalProps) {
  return (
    <div className="cashier-neon__modal-backdrop" role="dialog" aria-modal="true">
      <div className="cashier-neon__modal">
        <div className="cashier-neon__modal-icon">✓</div>
        <h2 className="cashier-neon__modal-title">{title}</h2>
        <div className="cashier-neon__modal-detail">
          {lines.map((line) => (
            <p key={line.label}>
              <span style={{ color: '#667788' }}>{line.label}: </span>
              {line.value}
            </p>
          ))}
        </div>
        <button type="button" className="cashier-neon__submit" onClick={onClose}>
          NEXT ORDER
        </button>
      </div>
    </div>
  )
}

export default function CashierPOS({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<Tab>('PAYMENT')
  const [tours, setTours] = useState<Tour[]>([])
  const [clients, setClients] = useState<CRMClient[]>([])
  const [history, setHistory] = useState<TourBookingWithClient[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [clientSearch, setClientSearch] = useState('')
  const [selectedClientId, setSelectedClientId] = useState('')
  const [tourId, setTourId] = useState('')
  const [isDeposit, setIsDeposit] = useState(true)
  const [amount, setAmount] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('PAYID')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [paymentSuccess, setPaymentSuccess] = useState<{
    ref: string
    clientName: string
    tourCode: string
    paid: number
  } | null>(null)

  const [vendor, setVendor] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [category, setCategory] = useState<ATOCategory>('Transport')
  const [hasGst, setHasGst] = useState(true)
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [expenseMsg, setExpenseMsg] = useState<string | null>(null)
  const [expenseSuccess, setExpenseSuccess] = useState<{
    vendor: string
    amount: number
    gst: number
  } | null>(null)

  const bookingStatus: BookingStatus = isDeposit ? 'DEPOSIT_PAID' : 'FULLY_PAID'

  const loadBase = useCallback(async () => {
    const [toursRes, clientsRes] = await Promise.all([
      supabase
        .from('tours')
        .select('*')
        .in('status', [...ACTIVE_STATUSES])
        .order('start_date', { ascending: true }),
      supabase.from('crm_clients').select('*').order('last_name_en', { ascending: true }),
    ])
    if (toursRes.error) throw new Error(toursRes.error.message)
    if (clientsRes.error) throw new Error(clientsRes.error.message)
    const tourList = filterAllowedTours((toursRes.data ?? []) as Tour[])
    setTours(tourList)
    setTourId((prev) => prev || tourList[0]?.id || '')
    setClients((clientsRes.data ?? []) as CRMClient[])
  }, [])

  const loadHistory = useCallback(async () => {
    const todayStart = sydneyTodayStartIso()
    const { data, error: err } = await supabase
      .from('tour_bookings')
      .select('*, crm_clients(first_name_th, last_name_th)')
      .gte('booked_at', todayStart)
      .order('booked_at', { ascending: false })

    if (err) throw new Error(err.message)
    setHistory((data ?? []) as TourBookingWithClient[])
  }, [])

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      await loadBase()
      if (tab === 'HISTORY') await loadHistory()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed')
    } finally {
      setLoading(false)
    }
  }, [loadBase, loadHistory, tab])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (tab !== 'HISTORY') return
    void loadHistory().catch((e) =>
      setError(e instanceof Error ? e.message : 'History load failed')
    )
  }, [tab, loadHistory])

  const filteredClients = useMemo(
    () => clients.filter((c) => matchesSearch(c, clientSearch)),
    [clients, clientSearch]
  )

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === selectedClientId) ?? null,
    [clients, selectedClientId]
  )

  const selectedTour = useMemo(() => tours.find((t) => t.id === tourId) ?? null, [tours, tourId])

  const amountNum = parseFloat(amount) || 0
  const expenseNum = parseFloat(expenseAmount) || 0
  const gstOnExpense = hasGst && expenseNum > 0 ? expenseNum / 11 : 0
  const exGstExpense = expenseNum - gstOnExpense

  const historyGstCollected = useMemo(
    () => history.reduce((sum, row) => sum + row.amount_paid_aud / 11, 0),
    [history]
  )

  const historyTotal = useMemo(
    () => history.reduce((sum, row) => sum + row.amount_paid_aud, 0),
    [history]
  )

  const resetPayment = () => {
    setPaymentSuccess(null)
    setAmount('')
    setSubmitError(null)
    setClientSearch('')
    setSelectedClientId('')
    setIsDeposit(true)
    setPaymentMethod('PAYID')
  }

  const handlePayment = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting || !selectedClient || !selectedTour || amountNum <= 0) return

    setSubmitting(true)
    setSubmitError(null)
    const reference = `TXN-${Math.floor(100_000 + Math.random() * 900_000)}`
    const now = new Date().toISOString()

    try {
      const { error: insertErr } = await supabase.from('tour_bookings').insert({
        tour_id: selectedTour.id,
        client_id: selectedClient.id,
        amount_paid_aud: amountNum,
        booking_status: bookingStatus,
        payment_method: paymentMethod,
        booked_at: now,
      })
      if (insertErr) throw insertErr

      void dispatchTransactionNotification({
        client_name: clientFullName(selectedClient),
        client_email: selectedClient.client_email ?? '',
        client_phone: selectedClient.phone ?? '',
        amount_aud: amountNum,
        reference_number: reference,
        trip_code: selectedTour.trip_code,
        payment_method: paymentMethod,
        booking_status: bookingStatus,
      })

      setPaymentSuccess({
        ref: reference,
        clientName: clientFullName(selectedClient),
        tourCode: selectedTour.trip_code,
        paid: amountNum,
      })
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Payment failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleExpense = async (e: FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!vendor.trim() || expenseNum <= 0) {
      setExpenseMsg('Enter vendor and amount')
      return
    }

    setSubmitting(true)
    setExpenseMsg(null)
    const tripCode = selectedTour?.trip_code ?? 'OFFLINE'
    const item: Expense = {
      id: crypto.randomUUID(),
      tour_id: tourId || null,
      amount_aud: expenseNum,
      has_gst: hasGst,
      gst_amount_aud: gstOnExpense,
      ato_category: category,
      vendor_name: vendor.trim(),
      receipt_filename: generateReceiptFilename(tripCode, expenseNum),
      is_synced: false,
      created_at: new Date().toISOString(),
    }

    const blob = receiptFile ?? new Blob(['receipt_placeholder'], { type: 'image/jpeg' })

    try {
      await saveExpenseLocally(item, blob)
      if (navigator.onLine) {
        const sync = await syncExpenseToGoogleWorkspace(item, blob)
        if (!sync.success) {
          setExpenseMsg(`Saved locally · sync pending (${sync.error ?? 'offline'})`)
        }
      }
      setExpenseSuccess({
        vendor: vendor.trim(),
        amount: expenseNum,
        gst: gstOnExpense,
      })
      setVendor('')
      setExpenseAmount('')
      setReceiptFile(null)
    } catch (err) {
      setExpenseMsg(err instanceof Error ? err.message : 'Expense save failed')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !tours.length && !clients.length) {
    return <div className="cashier-neon__loading">SYNCING POS…</div>
  }

  return (
    <div className="cashier-neon">
      <div className="cashier-neon__grid" aria-hidden />
      <div className="cashier-neon__scanlines" aria-hidden />

      <div className="cashier-neon__inner">
        <header className="cashier-neon__topbar">
          <div>
            <p className="cashier-neon__title">POS TERMINAL</p>
            <p className="cashier-neon__mono text-[9px] text-[#556677] mt-0.5">CASHIER · 4444</p>
          </div>
          <LiveClock />
          <button type="button" onClick={onLogout} className="cashier-neon__exit">
            EXIT
          </button>
        </header>

        <nav className="cashier-neon__tabs" aria-label="POS sections">
          {(['PAYMENT', 'EXPENSE', 'HISTORY'] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`cashier-neon__tab ${tab === t ? 'cashier-neon__tab--active' : ''}`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </nav>

        {error && (
          <div className="cashier-neon__panel mb-3 flex justify-between gap-2 items-center">
            <span className="cashier-neon__error m-0 text-left">{error}</span>
            <button type="button" className="cashier-neon__exit" onClick={() => void refresh()}>
              RETRY
            </button>
          </div>
        )}

        {tab === 'PAYMENT' && (
          <form onSubmit={handlePayment} className="cashier-neon__panel space-y-0">
            <label className="cashier-neon__label" htmlFor="tour-select">
              Tour
            </label>
            <select
              id="tour-select"
              value={tourId}
              onChange={(e) => setTourId(e.target.value)}
              className="cashier-neon__select"
            >
              {tours.length === 0 ? (
                <option value="">No active tours</option>
              ) : (
                tours.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.trip_code} — {t.destination}
                  </option>
                ))
              )}
            </select>

            <label className="cashier-neon__label" htmlFor="client-search">
              Client
            </label>
            <input
              id="client-search"
              type="search"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              placeholder="Search name or passport…"
              className="cashier-neon__input"
              autoComplete="off"
            />
            <select
              id="client-select"
              value={selectedClientId}
              onChange={(e) => setSelectedClientId(e.target.value)}
              className="cashier-neon__select"
              required
            >
              <option value="">Select client…</option>
              {filteredClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {clientFullName(c)} · {c.passport_number}
                </option>
              ))}
            </select>

            <label className="cashier-neon__label" htmlFor="amount">
              Amount (AUD)
            </label>
            <input
              id="amount"
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="cashier-neon__input cashier-neon__amount"
            />

            <p className="cashier-neon__label">Payment method</p>
            <div className="cashier-neon__methods">
              {PAYMENT_METHODS.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setPaymentMethod(m)}
                  className={`cashier-neon__method ${
                    paymentMethod === m ? 'cashier-neon__method--active' : ''
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            <div className="cashier-neon__toggle-row">
              <div>
                <p className="text-xs font-semibold text-[#c8d8e8]">Deposit payment</p>
                <p className="cashier-neon__mono text-[10px] text-[#556677] mt-0.5">
                  {isDeposit ? 'DEPOSIT_PAID' : 'FULLY_PAID'}
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={isDeposit}
                className={`cashier-neon__toggle ${isDeposit ? 'cashier-neon__toggle--on' : ''}`}
                onClick={() => setIsDeposit((v) => !v)}
              >
                <span className="cashier-neon__toggle-knob" />
              </button>
            </div>

            {submitError && <p className="cashier-neon__error">{submitError}</p>}

            <button
              type="submit"
              disabled={!selectedClientId || !tourId || amountNum <= 0 || submitting}
              className="cashier-neon__submit"
            >
              {submitting ? 'PROCESSING…' : 'EXECUTE PAYMENT'}
            </button>
          </form>
        )}

        {tab === 'EXPENSE' && (
          <form onSubmit={handleExpense} className="cashier-neon__panel">
            <label className="cashier-neon__label" htmlFor="exp-tour">
              Tour (optional)
            </label>
            <select
              id="exp-tour"
              value={tourId}
              onChange={(e) => setTourId(e.target.value)}
              className="cashier-neon__select"
            >
              <option value="">General expense</option>
              {tours.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.trip_code}
                </option>
              ))}
            </select>

            <label className="cashier-neon__label" htmlFor="vendor">
              Vendor
            </label>
            <input
              id="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Vendor name"
              className="cashier-neon__input"
            />

            <label className="cashier-neon__label" htmlFor="exp-amount">
              Amount (AUD)
            </label>
            <input
              id="exp-amount"
              type="number"
              min="0"
              step="0.01"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
              placeholder="0.00"
              className="cashier-neon__input cashier-neon__mono"
            />

            <label className="cashier-neon__label" htmlFor="ato-cat">
              ATO category
            </label>
            <select
              id="ato-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as ATOCategory)}
              className="cashier-neon__select"
            >
              {ATO_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <div className="cashier-neon__toggle-row">
              <div>
                <p className="text-xs font-semibold text-[#c8d8e8]">GST included</p>
                {expenseNum > 0 && (
                  <p className="cashier-neon__mono text-[10px] text-[#556677] mt-0.5">
                    GST {formatAUD(gstOnExpense)} · ex-GST {formatAUD(exGstExpense)}
                  </p>
                )}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={hasGst}
                className={`cashier-neon__toggle ${hasGst ? 'cashier-neon__toggle--on' : ''}`}
                onClick={() => setHasGst((v) => !v)}
              >
                <span className="cashier-neon__toggle-knob" />
              </button>
            </div>

            <label className="cashier-neon__label" htmlFor="receipt">
              Receipt photo
            </label>
            <input
              id="receipt"
              type="file"
              accept="image/*"
              onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
              className="cashier-neon__input text-[10px] text-[#667788] mb-3"
            />

            {expenseMsg && <p className="cashier-neon__msg">{expenseMsg}</p>}

            <button type="submit" disabled={submitting} className="cashier-neon__submit">
              {submitting ? 'SAVING…' : 'LOG EXPENSE'}
            </button>
          </form>
        )}

        {tab === 'HISTORY' && (
          <section className="cashier-neon__panel">
            <p className="cashier-neon__label mb-2">Today · Sydney</p>
            {history.length === 0 ? (
              <p className="text-sm text-[#667788]">No transactions yet today.</p>
            ) : (
              <ul>
                {history.map((row) => (
                  <li key={row.id} className="cashier-neon__history-item">
                    <div>
                      <p className="font-medium text-[#e8f4ff]">{clientThaiName(row.crm_clients)}</p>
                      <p className="cashier-neon__mono text-[10px] text-[#556677]">
                        {row.payment_method ?? '—'} ·{' '}
                        {row.booked_at
                          ? new Date(row.booked_at).toLocaleTimeString('en-AU', {
                              hour: '2-digit',
                              minute: '2-digit',
                              timeZone: 'Australia/Sydney',
                            })
                          : '—'}
                      </p>
                    </div>
                    <span className="cashier-neon__mono text-[#00f5ff] shrink-0">
                      {formatAUD(row.amount_paid_aud)}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <div className="cashier-neon__history-summary">
              <div className="cashier-neon__gst-line">
                <span>Transactions</span>
                <strong>{history.length}</strong>
              </div>
              <div className="cashier-neon__gst-line">
                <span>Total collected</span>
                <strong>{formatAUD(historyTotal)}</strong>
              </div>
              <div className="cashier-neon__gst-line">
                <span>GST collected (1/11)</span>
                <strong className="text-[#39ff14]">{formatAUD(historyGstCollected)}</strong>
              </div>
            </div>
          </section>
        )}
      </div>

      {paymentSuccess && (
        <SuccessModal
          title="PAYMENT CONFIRMED"
          lines={[
            { label: 'REF', value: paymentSuccess.ref },
            { label: 'CLIENT', value: paymentSuccess.clientName },
            { label: 'TOUR', value: paymentSuccess.tourCode },
            { label: 'PAID', value: formatAUD(paymentSuccess.paid) },
          ]}
          onClose={resetPayment}
        />
      )}

      {expenseSuccess && (
        <SuccessModal
          title="EXPENSE LOGGED"
          lines={[
            { label: 'VENDOR', value: expenseSuccess.vendor },
            { label: 'AMOUNT', value: formatAUD(expenseSuccess.amount) },
            { label: 'GST', value: formatAUD(expenseSuccess.gst) },
          ]}
          onClose={() => {
            setExpenseSuccess(null)
            setExpenseMsg(null)
          }}
        />
      )}
    </div>
  )
}
