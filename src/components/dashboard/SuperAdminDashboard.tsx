// Chapter99 V4 — Phase 7
// Super Admin Dashboard (PIN 3501)
// Full overview of all shops, MRR, alerts, proposals

import { useState, useEffect, lazy, Suspense } from 'react'
import type { ShopOverview, MRRSummary } from '../../types/admin'
import {
  fetchAllShops,
  fetchMRRSummary,
  fetchRevenueHistory,
  toggleShopStatus,
} from '../../lib/adminService'
import { formatAUD } from '../../lib/posCalc'
import AddShopModal from '../shops/AddShopModal'
import ProposalBuilder from '../proposals/ProposalBuilder'
import ShopWebsiteSettingsPanel from '../admin/ShopWebsiteSettings'
import ShopPlanBilling from '../admin/ShopPlanBilling'
import { PLAN_LABELS } from '../../types/plan'

const OwnerReports = lazy(() => import('./OwnerReports'))

type AdminTab = 'overview' | 'shops' | 'proposals' | 'settings'

export default function SuperAdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('overview')
  const [shops, setShops] = useState<ShopOverview[]>([])
  const [mrr, setMrr] = useState<MRRSummary | null>(null)
  const [revenueHistory, setRevenueHistory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddShop, setShowAddShop] = useState(false)
  const [showProposal, setShowProposal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [shopsData, historyData] = await Promise.all([
      fetchAllShops(),
      fetchRevenueHistory(),
    ])
    const mrrData = await fetchMRRSummary(shopsData)
    setShops(shopsData)
    setMrr(mrrData)
    setRevenueHistory(historyData)
    setLoading(false)
  }

  const filtered = shops.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.ownerEmail.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const TABS: { id: AdminTab; label: string; icon: string }[] = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'shops', label: `Shops (${shops.length})`, icon: '🏪' },
    { id: 'proposals', label: 'Proposals', icon: '📋' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ]

  if (loading) return <LoadingScreen />

  return (
    <div className="admin-root">
      {/* Top Bar */}
      <div className="admin-topbar">
        <div className="admin-logo">
          <span className="logo-c99">Chapter99</span>
          <span className="logo-badge">Super Admin</span>
        </div>
        <div className="admin-topbar-right">
          <span className="mrr-display">
            MRR: {mrr ? formatAUD(mrr.total) : '—'}
          </span>
          <span className="pin-display">PIN 3501 ✓</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`admin-tab${tab === t.id ? ' active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="admin-content">
        {tab === 'overview' && mrr && (
          <OverviewTab mrr={mrr} shops={shops} history={revenueHistory} />
        )}
        {tab === 'shops' && (
          selectedShopId ? (
            <ShopDetailView
              shop={shops.find(s => s.id === selectedShopId)!}
              onBack={() => setSelectedShopId(null)}
              onToggle={async (id, active) => {
                await toggleShopStatus(id, active)
                loadData()
              }}
            />
          ) : (
            <ShopsTab
              shops={filtered}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              onAddShop={() => setShowAddShop(true)}
              onSelectShop={setSelectedShopId}
              onToggle={async (id, active) => {
                await toggleShopStatus(id, active)
                loadData()
              }}
            />
          )
        )}
        {tab === 'proposals' && (
          <ProposalBuilder onClose={() => setShowProposal(false)} />
        )}
        {tab === 'settings' && <SettingsTab />}
      </div>

      {/* Modals */}
      {showAddShop && (
        <AddShopModal
          onClose={() => setShowAddShop(false)}
          onSaved={() => { setShowAddShop(false); loadData() }}
        />
      )}
    </div>
  )
}

// ── Overview Tab ──────────────────────────────────────────────
function OverviewTab({ mrr, shops, history }: {
  mrr: MRRSummary
  shops: ShopOverview[]
  history: any[]
}) {
  const criticalShops = shops.filter(s => s.criticalAlerts > 0)

  return (
    <div className="overview-tab">
      {/* MRR Cards */}
      <div className="metric-grid">
        <MetricCard label="Total MRR" value={formatAUD(mrr.total)} sub="+12.5% vs last month" color="teal" />
        <MetricCard label="Active Shops" value={mrr.activeShops.toString()} sub={`of ${mrr.totalShops} total`} color="blue" />
        <MetricCard label="New This Month" value={mrr.newThisMonth.toString()} sub="new clients" color="green" />
        <MetricCard label="Annual Run Rate" value={formatAUD(mrr.total * 12)} sub="projected" color="amber" />
      </div>

      {/* Plan Breakdown */}
      <div className="section-card">
        <div className="section-title">MRR by Plan</div>
        <div className="plan-bars">
          {[
            { label: 'Pro', amount: mrr.byPlan.pro, color: '#0F6E56', price: '$199' },
            { label: 'Growth', amount: mrr.byPlan.growth, color: '#BA7517', price: '$129' },
            { label: 'Starter', amount: mrr.byPlan.starter, color: '#3B6D11', price: '$69' },
          ].map(p => (
            <div key={p.label} className="plan-bar-row">
              <div className="plan-bar-label">
                <span>{p.label}</span>
                <span className="plan-bar-price">{p.price}/mo</span>
              </div>
              <div className="plan-bar-track">
                <div
                  className="plan-bar-fill"
                  style={{
                    width: `${mrr.total > 0 ? (p.amount / mrr.total) * 100 : 0}%`,
                    background: p.color,
                  }}
                />
              </div>
              <div className="plan-bar-amount">{formatAUD(p.amount)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Critical Alerts */}
      {criticalShops.length > 0 && (
        <div className="section-card alert-section">
          <div className="section-title">🔴 Critical Alerts Across Shops</div>
          {criticalShops.map(s => (
            <div key={s.id} className="alert-shop-row">
              <span className="alert-shop-name">{s.name}</span>
              <span className="alert-shop-count">{s.criticalAlerts} critical</span>
            </div>
          ))}
        </div>
      )}

      {/* Revenue Chart (simple bars) */}
      {history.length > 0 && (
        <div className="section-card">
          <div className="section-title">Revenue — Last 12 Months</div>
          <SimpleBarChart data={history} />
        </div>
      )}
    </div>
  )
}

type ShopDetailTab = 'overview' | 'website' | 'plan' | 'reports'

// ── Shop detail (Overview + Website tab) ───────────────────────
function ShopDetailView({
  shop,
  onBack,
  onToggle,
}: {
  shop: ShopOverview | undefined
  onBack: () => void
  onToggle: (id: string, active: boolean) => void
}) {
  const [detailTab, setDetailTab] = useState<ShopDetailTab>('website')

  if (!shop) {
    return (
      <div className="shop-detail">
        <button type="button" className="action-btn" onClick={onBack}>
          ← Back to shops
        </button>
        <p className="sws-muted">Shop not found.</p>
      </div>
    )
  }

  return (
    <div className="shop-detail">
      <div className="shop-detail-header">
        <button type="button" className="action-btn" onClick={onBack}>
          ← Back to shops
        </button>
        <div className="shop-detail-title">
          <h2>{shop.name}</h2>
          <p className="shop-detail-meta">
            {shop.id}
            {shop.slug ? ` · slug: ${shop.slug}` : ''}
            {' · '}
            <span className={`plan-tag plan-${shop.plan}`}>{PLAN_LABELS[shop.plan]}</span>
          </p>
        </div>
        <div className="shop-detail-actions">
          <button
            type="button"
            className="action-btn"
            onClick={() => {
              const url = shop.slug
                ? `${window.location.origin}/?shop=${encodeURIComponent(shop.slug)}`
                : `${window.location.origin}/book`
              window.open(url, '_blank')
            }}
          >
            Open public site
          </button>
          <button
            type="button"
            className={`action-btn ${shop.status === 'active' ? 'danger' : 'success'}`}
            onClick={() => onToggle(shop.id, shop.status !== 'active')}
          >
            {shop.status === 'active' ? 'Suspend' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="shop-detail-tabs">
        <button
          type="button"
          className={`shop-detail-tab${detailTab === 'overview' ? ' active' : ''}`}
          onClick={() => setDetailTab('overview')}
        >
          📊 Overview
        </button>
        <button
          type="button"
          className={`shop-detail-tab${detailTab === 'website' ? ' active' : ''}`}
          onClick={() => setDetailTab('website')}
        >
          🌐 Website
        </button>
        <button
          type="button"
          className={`shop-detail-tab${detailTab === 'plan' ? ' active' : ''}`}
          onClick={() => setDetailTab('plan')}
        >
          💳 Plan & Billing
        </button>
        <button
          type="button"
          className={`shop-detail-tab${detailTab === 'reports' ? ' active' : ''}`}
          onClick={() => setDetailTab('reports')}
        >
          📈 Reports
        </button>
      </div>

      {detailTab === 'overview' && (
        <div className="section-card shop-detail-stats">
          <div className="shop-stat">
            <span className="shop-stat-label">MRR</span>
            <span className="shop-stat-value">{formatAUD(shop.mrr)}</span>
          </div>
          <div className="shop-stat">
            <span className="shop-stat-label">Bookings (month)</span>
            <span className="shop-stat-value">{shop.bookingsThisMonth}</span>
          </div>
          <div className="shop-stat">
            <span className="shop-stat-label">Revenue (month)</span>
            <span className="shop-stat-value">{formatAUD(shop.revenueThisMonth)}</span>
          </div>
          <div className="shop-stat">
            <span className="shop-stat-label">Contact</span>
            <span className="shop-stat-value shop-stat-contact">
              {shop.ownerEmail || '—'}
              {shop.ownerPhone ? ` · ${shop.ownerPhone}` : ''}
            </span>
          </div>
        </div>
      )}

      {detailTab === 'website' && (
        <ShopWebsiteSettingsPanel shopId={shop.id} shopName={shop.name} />
      )}

      {detailTab === 'plan' && (
        <ShopPlanBilling shopId={shop.id} shopName={shop.name} />
      )}

      {detailTab === 'reports' && (
        <Suspense fallback={<p className="sws-muted">Loading reports…</p>}>
          <OwnerReports shopId={shop.id} />
        </Suspense>
      )}
    </div>
  )
}

// ── Shops Tab ─────────────────────────────────────────────────
function ShopsTab({ shops, searchQuery, onSearch, onAddShop, onSelectShop, onToggle }: {
  shops: ShopOverview[]
  searchQuery: string
  onSearch: (q: string) => void
  onAddShop: () => void
  onSelectShop: (id: string) => void
  onToggle: (id: string, active: boolean) => void
}) {
  return (
    <div className="shops-tab">
      <div className="shops-header">
        <input
          className="search-input"
          placeholder="Search shops..."
          value={searchQuery}
          onChange={e => onSearch(e.target.value)}
        />
        <button className="add-shop-btn" onClick={onAddShop}>
          + เพิ่มร้านใหม่
        </button>
      </div>

      <div className="shops-table">
        <div className="table-header">
          <span>ร้าน</span>
          <span>Plan</span>
          <span>MRR</span>
          <span>คิวเดือนนี้</span>
          <span>รายได้เดือนนี้</span>
          <span>Alerts</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {shops.map(shop => (
          <div key={shop.id} className="table-row table-row-clickable">
            <button
              type="button"
              className="shop-info shop-info-btn"
              onClick={() => onSelectShop(shop.id)}
            >
              <div className="shop-name">{shop.name}</div>
              <div className="shop-domain">
                {shop.slug ? `?shop=${shop.slug}` : shop.domain}
              </div>
            </button>
            <span className={`plan-tag plan-${shop.plan}`}>{PLAN_LABELS[shop.plan]}</span>
            <span className="cell-mrr">{formatAUD(shop.mrr)}</span>
            <span className="cell-num">{shop.bookingsThisMonth}</span>
            <span className="cell-revenue">{formatAUD(shop.revenueThisMonth)}</span>
            <span className={`cell-alerts${shop.criticalAlerts > 0 ? ' critical' : ''}`}>
              {shop.alertCount > 0 ? `⚠️ ${shop.alertCount}` : '✅'}
            </span>
            <span className={`status-tag status-${shop.status}`}>
              {shop.status}
            </span>
            <div className="cell-actions">
              <button
                type="button"
                className="action-btn"
                onClick={() => onSelectShop(shop.id)}
              >
                🌐 Website
              </button>
              <button
                className={`action-btn ${shop.status === 'active' ? 'danger' : 'success'}`}
                onClick={() => onToggle(shop.id, shop.status !== 'active')}
              >
                {shop.status === 'active' ? 'Suspend' : 'Activate'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Settings Tab ──────────────────────────────────────────────
function SettingsTab() {
  return (
    <div className="settings-tab">
      <div className="section-card">
        <div className="section-title">Chapter99 Global Settings</div>
        <div className="settings-list">
          <SettingRow label="Default Card Surcharge" value="1.5%" />
          <SettingRow label="Default GST Rate" value="10% (AU Standard)" />
          <SettingRow label="SMS Provider" value="Twilio AU" />
          <SettingRow label="Email Provider" value="Resend" />
          <SettingRow label="Storage" value="Google Drive + Supabase" />
          <SettingRow label="Deploy" value="Vercel + GitHub" />
          <SettingRow label="App Version" value="V4.0.0" />
        </div>
      </div>
      <div className="section-card">
        <div className="section-title">PIN Management</div>
        <div className="settings-list">
          <SettingRow label="Staff PIN" value="1111" />
          <SettingRow label="Cashier PIN" value="4444" />
          <SettingRow label="Owner PIN" value="9999" />
          <SettingRow label="Super Admin PIN" value="3501 (You)" />
        </div>
      </div>
    </div>
  )
}

// ── Helper Components ─────────────────────────────────────────
function MetricCard({ label, value, sub, color }: {
  label: string; value: string; sub: string; color: string
}) {
  const colors: Record<string, string> = {
    teal: '#0F6E56', blue: '#185FA5', green: '#3B6D11', amber: '#BA7517'
  }
  return (
    <div className="metric-card">
      <div className="metric-label">{label}</div>
      <div className="metric-value" style={{ color: colors[color] }}>{value}</div>
      <div className="metric-sub">{sub}</div>
    </div>
  )
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="setting-row">
      <span className="setting-label">{label}</span>
      <span className="setting-value">{value}</span>
    </div>
  )
}

function SimpleBarChart({ data }: { data: { month: string; revenue: number }[] }) {
  const max = Math.max(...data.map(d => d.revenue), 1)
  const last6 = data.slice(-6)
  return (
    <div className="bar-chart">
      {last6.map(d => (
        <div key={d.month} className="bar-col">
          <div className="bar-amount">{formatAUD(d.revenue)}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ height: `${(d.revenue / max) * 100}%` }}
            />
          </div>
          <div className="bar-label">
            {new Date(d.month + '-01').toLocaleString('en-AU', { month: 'short' })}
          </div>
        </div>
      ))}
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="admin-loading">
      <div className="loading-logo">Chapter99</div>
      <div className="loading-text">Loading Super Admin...</div>
    </div>
  )
}
