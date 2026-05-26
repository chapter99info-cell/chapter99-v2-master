import { useCallback, useEffect, useMemo, useState } from 'react'
import Trip2TalkShell, { T2Button, T2Card, SkeletonCard } from '../components/trip2talk/Trip2TalkShell'
import {
  buildSettlementForTour,
  syncExpenseToGoogleWorkspace,
  syncSettlementToGoogleSheets,
} from '../lib/googleSync'
import { formatAUD } from '../lib/payidCalc'
import {
  computeOwnerKpis,
  fetchOwnerDashboardData,
  fetchTableCounts,
  tourRevenue,
  type MonthlyRevenue,
  type OwnerDashboardData,
  type OwnerTableName,
} from '../lib/ownerDashboardData'
import { supabase } from '../lib/supabase'
import type { StaffCommissionLedgerRow, Tour, TourStatus } from '../types/tour'

const GOLD = '#fbbf24'
const LS_EXPENSE_SYNC = 't2_owner_last_expense_sync'
const LS_SETTLEMENT_SYNC = 't2_owner_last_settlement_sync'

type TabId = 'kpi' | 'tours' | 'commission' | 'sync'

const TABS: { id: TabId; label: string }[] = [
  { id: 'kpi', label: 'KPI' },
  { id: 'tours', label: 'TOURS' },
  { id: 'commission', label: 'COMM' },
  { id: 'sync', label: 'SYNC' },
]

const STATUS_STYLES: Record<TourStatus, string> = {
  PLANNING: 'bg-neutral-700 text-neutral-300',
  CONFIRMED: 'bg-emerald-900/60 text-emerald-300 border border-emerald-600/40',
  ACTIVE: 'bg-[#fbbf24]/20 text-[#fbbf24] border border-[#fbbf24]/50',
  COMPLETED: 'bg-blue-900/50 text-blue-300 border border-blue-600/40',
  CANCELLED: 'bg-red-900/50 text-red-300 border border-red-600/40',
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return 'Never'
  try {
    return new Date(iso).toLocaleString('en-AU', {
      timeZone: 'Australia/Sydney',
      dateStyle: 'short',
      timeStyle: 'short',
    })
  } catch {
    return iso
  }
}

function RevenueBarChart({ months }: { months: MonthlyRevenue[] }) {
  const max = Math.max(...months.map((m) => m.amount), 1)
  const w = 280
  const h = 120
  const barW = w / months.length - 8

  return (
    <svg viewBox={`0 0 ${w} ${h + 24}`} className="w-full max-w-sm" aria-label="Last 6 months revenue">
      {months.map((m, i) => {
        const barH = Math.max(4, (m.amount / max) * h)
        const x = i * (barW + 8) + 4
        const y = h - barH
        return (
          <g key={m.label}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={barH}
              rx={4}
              fill={GOLD}
              fillOpacity={0.85}
            />
            <text
              x={x + barW / 2}
              y={h + 16}
              textAnchor="middle"
              fill="#9ca3af"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
            >
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: `${GOLD}44`, background: `${GOLD}0d` }}
    >
      <p className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold" style={{ color: GOLD }}>
        {value}
      </p>
    </div>
  )
}

function TourStatusBadge({ status }: { status: TourStatus }) {
  return (
    <span className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}>
      {status}
    </span>
  )
}

export default function OwnerDashboard({ onLogout }: { onLogout: () => void }) {
  const [tab, setTab] = useState<TabId>('kpi')
  const [data, setData] = useState<OwnerDashboardData | null>(null)
  const [commissions, setCommissions] = useState<StaffCommissionLedgerRow[]>([])
  const [tableCounts, setTableCounts] = useState<Record<OwnerTableName, number | null> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [syncBusy, setSyncBusy] = useState<'expense' | 'settlement' | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [lastExpenseSync, setLastExpenseSync] = useState<string | null>(() =>
    localStorage.getItem(LS_EXPENSE_SYNC)
  )
  const [lastSettlementSync, setLastSettlementSync] = useState<string | null>(() =>
    localStorage.getItem(LS_SETTLEMENT_SYNC)
  )
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, commRes, counts] = await Promise.all([
        fetchOwnerDashboardData(),
        supabase
          .from('staff_commission_ledger')
          .select('*, staff_profiles(full_name, role)')
          .order('created_at', { ascending: false }),
        fetchTableCounts(),
      ])
      setData(dash)
      if (commRes.error) {
        console.warn('[Owner] commission load:', commRes.error.message)
        setCommissions([])
      } else {
        setCommissions((commRes.data ?? []) as StaffCommissionLedgerRow[])
      }
      setTableCounts(counts)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(
    () =>
      data
        ? computeOwnerKpis(data.tours, data.bookings, data.expenses)
        : null,
    [data]
  )

  const unpaidTotal = useMemo(
    () => commissions.filter((c) => !c.is_paid).reduce((s, c) => s + Number(c.amount_aud), 0),
    [commissions]
  )

  const handleTogglePaid = async (row: StaffCommissionLedgerRow) => {
    setTogglingId(row.id)
    const next = !row.is_paid
    const { error: err } = await supabase
      .from('staff_commission_ledger')
      .update({ is_paid: next })
      .eq('id', row.id)
    setTogglingId(null)
    if (err) {
      setSyncMsg(err.message)
      return
    }
    setCommissions((prev) => prev.map((c) => (c.id === row.id ? { ...c, is_paid: next } : c)))
  }

  const handleSyncExpenses = async () => {
    if (!data || syncBusy) return
    setSyncBusy('expense')
    setSyncMsg(null)
    const unsynced = data.expenses.filter((e) => !e.is_synced)
    if (unsynced.length === 0) {
      setSyncMsg('No unsynced expenses')
      setSyncBusy(null)
      return
    }
    let ok = 0
    try {
      for (const expense of unsynced) {
        const result = await syncExpenseToGoogleWorkspace(expense, null)
        if (!result.success) throw new Error(result.error ?? 'Expense sync failed')
        await supabase.from('expenses').update({ is_synced: true }).eq('id', expense.id)
        ok += 1
      }
      const ts = new Date().toISOString()
      localStorage.setItem(LS_EXPENSE_SYNC, ts)
      setLastExpenseSync(ts)
      setSyncMsg(`Synced ${ok} expense(s) to Google`)
      setData((prev) =>
        prev
          ? {
              ...prev,
              expenses: prev.expenses.map((e) => ({ ...e, is_synced: true })),
            }
          : prev
      )
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Expense sync failed')
    } finally {
      setSyncBusy(null)
    }
  }

  const handleSyncSettlements = async () => {
    if (!data || syncBusy) return
    setSyncBusy('settlement')
    setSyncMsg(null)
    const targets = data.tours.filter((t) => t.status === 'COMPLETED' || t.status === 'ACTIVE')
    if (targets.length === 0) {
      setSyncMsg('No tours to settle')
      setSyncBusy(null)
      return
    }
    try {
      for (const tour of targets) {
        const payload = buildSettlementForTour(tour, data.bookings, data.expenses)
        const result = await syncSettlementToGoogleSheets(payload)
        if (!result.success) throw new Error(result.error ?? `Settlement failed: ${tour.trip_code}`)
      }
      const ts = new Date().toISOString()
      localStorage.setItem(LS_SETTLEMENT_SYNC, ts)
      setLastSettlementSync(ts)
      setSyncMsg(`Synced ${targets.length} settlement(s)`)
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : 'Settlement sync failed')
    } finally {
      setSyncBusy(null)
    }
  }

  return (
    <Trip2TalkShell className="p-4 pb-8">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-neutral-500 font-mono">Owner · PIN 9999</p>
          <h1 className="mt-1 text-xl font-semibold" style={{ color: GOLD }}>
            Owner Dashboard
          </h1>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-lg border border-neutral-700 px-3 py-2 text-xs text-neutral-400 hover:border-[#fbbf24]/50 hover:text-[#fbbf24]"
        >
          EXIT
        </button>
      </header>

      <nav className="mb-4 flex gap-1 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-900 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`min-w-[4rem] flex-1 rounded-lg px-2 py-2 text-[10px] font-bold tracking-widest transition ${
              tab === t.id ? 'text-neutral-950' : 'text-neutral-500 hover:text-neutral-300'
            }`}
            style={tab === t.id ? { background: GOLD } : undefined}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {error && (
        <T2Card className="mb-4 border-red-800/50">
          <p className="text-sm text-red-400">{error}</p>
          <T2Button className="mt-3" variant="ghost" onClick={() => void load()}>
            Retry
          </T2Button>
        </T2Card>
      )}

      {loading && (
        <div className="space-y-3">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {!loading && tab === 'kpi' && kpis && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <KpiCard label="YTD Revenue" value={formatAUD(kpis.ytdRevenue)} />
            <KpiCard label="YTD Expenses" value={formatAUD(kpis.ytdExpenses)} />
            <KpiCard label="Net Profit" value={formatAUD(kpis.netProfit)} />
            <KpiCard label="GST Collected" value={formatAUD(kpis.gstCollected)} />
            <KpiCard label="GST Claimed" value={formatAUD(kpis.gstClaimed)} />
            <KpiCard label="Active Tours" value={String(kpis.activeTours)} />
          </div>
          <T2Card>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-3">Revenue · last 6 months</p>
            <RevenueBarChart months={kpis.monthlyRevenue} />
          </T2Card>
        </div>
      )}

      {!loading && tab === 'tours' && data && (
        <div className="space-y-3">
          {data.tours.length === 0 ? (
            <T2Card>
              <p className="text-sm text-neutral-500">No tours</p>
            </T2Card>
          ) : (
            [...data.tours]
              .sort((a, b) => a.start_date.localeCompare(b.start_date))
              .map((t: Tour) => {
                const rev = tourRevenue(t.id, data.bookings)
                const paxPct = t.max_pax > 0 ? Math.min(100, (t.current_pax / t.max_pax) * 100) : 0
                return (
                  <T2Card key={t.id}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-sm" style={{ color: GOLD }}>
                          {t.trip_code}
                        </p>
                        <p className="text-xs text-neutral-400 mt-0.5">{t.destination}</p>
                      </div>
                      <TourStatusBadge status={t.status} />
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-neutral-800 overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${paxPct}%`, background: GOLD }}
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-neutral-500 font-mono">
                      {t.current_pax}/{t.max_pax} pax · {formatAUD(t.price_aud)} pp
                    </p>
                    <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs">
                      <span className="text-neutral-400">
                        {t.start_date} → {t.end_date}
                      </span>
                      <span className="font-mono font-medium text-emerald-400/90">
                        Rev {formatAUD(rev)}
                      </span>
                    </div>
                  </T2Card>
                )
              })
          )}
        </div>
      )}

      {!loading && tab === 'commission' && (
        <div className="space-y-3">
          {commissions.length === 0 ? (
            <T2Card>
              <p className="text-sm text-neutral-500">No commission rows (run 013–015 SQL)</p>
            </T2Card>
          ) : (
            commissions.map((row) => (
              <T2Card key={row.id}>
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-sm text-neutral-100">
                      {row.staff_profiles?.full_name ?? 'Staff'}
                    </p>
                    <p className="text-[10px] text-neutral-500 uppercase">
                      {row.staff_profiles?.role ?? '—'}
                    </p>
                    {row.description && (
                      <p className="mt-1 text-xs text-neutral-400">{row.description}</p>
                    )}
                  </div>
                  <p className="font-mono text-sm shrink-0" style={{ color: GOLD }}>
                    {formatAUD(Number(row.amount_aud))}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={togglingId === row.id}
                  onClick={() => void handleTogglePaid(row)}
                  className={`mt-3 w-full rounded-lg border py-2 text-xs font-semibold uppercase tracking-wide transition active:scale-95 disabled:opacity-50 ${
                    row.is_paid
                      ? 'border-emerald-600/50 bg-emerald-900/30 text-emerald-300'
                      : 'border-[#fbbf24]/40 bg-[#fbbf24]/10 text-[#fbbf24]'
                  }`}
                >
                  {row.is_paid ? 'Paid ✓' : 'Mark paid'}
                </button>
              </T2Card>
            ))
          )}
          <T2Card className="border-[#fbbf24]/30">
            <p className="text-[10px] uppercase tracking-widest text-neutral-500">Unpaid total</p>
            <p className="mt-1 font-mono text-xl font-semibold text-red-400">{formatAUD(unpaidTotal)}</p>
          </T2Card>
        </div>
      )}

      {!loading && tab === 'sync' && (
        <div className="space-y-4">
          <T2Card className="space-y-3">
            <T2Button
              disabled={syncBusy !== null}
              onClick={() => void handleSyncExpenses()}
            >
              {syncBusy === 'expense' ? 'Syncing expenses…' : 'Sync expenses'}
            </T2Button>
            <p className="text-[10px] text-neutral-500 font-mono">
              Last expense sync: {formatSyncTime(lastExpenseSync)}
            </p>
            <T2Button
              variant="ghost"
              disabled={syncBusy !== null}
              onClick={() => void handleSyncSettlements()}
            >
              {syncBusy === 'settlement' ? 'Syncing settlements…' : 'Sync settlements'}
            </T2Button>
            <p className="text-[10px] text-neutral-500 font-mono">
              Last settlement sync: {formatSyncTime(lastSettlementSync)}
            </p>
            {syncMsg && <p className="text-xs text-[#fbbf24]">{syncMsg}</p>}
          </T2Card>

          <T2Card>
            <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-2">Table row counts</p>
            <ul className="space-y-1 font-mono text-xs">
              {tableCounts &&
                (Object.entries(tableCounts) as [OwnerTableName, number | null][]).map(([name, count]) => (
                  <li key={name} className="flex justify-between text-neutral-400">
                    <span>{name}</span>
                    <span style={{ color: count === null ? '#f87171' : GOLD }}>
                      {count === null ? 'ERR' : count}
                    </span>
                  </li>
                ))}
            </ul>
          </T2Card>
        </div>
      )}
    </Trip2TalkShell>
  )
}
