// Chapter99 V4 — Phase 7
// Super Admin Types (PIN 3501)

export interface ShopOverview {
  id: string
  name: string
  plan: 'starter' | 'professional' | 'business'
  status: 'active' | 'overdue' | 'suspended'
  mrr: number                // Monthly Recurring Revenue
  setupFee: number
  joinedAt: string
  lastActivity: string
  // Stats
  bookingsThisMonth: number
  revenueThisMonth: number
  activeStaff: number
  // Alerts
  alertCount: number
  criticalAlerts: number
  // Contact
  ownerName: string
  ownerPhone: string
  ownerEmail: string
  domain: string
}

export interface MRRSummary {
  total: number              // Total MRR all shops
  byPlan: {
    starter: number
    professional: number
    business: number
  }
  growth: number             // % vs last month
  churnRisk: number          // shops with overdue payment
  newThisMonth: number
  totalShops: number
  activeShops: number
}

export interface Proposal {
  id: string
  shopName: string
  location: string
  tier: 'starter' | 'professional' | 'business'
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired'
  setupFee: number
  monthlyFee: number
  bundleName?: string
  bundleTotal?: number
  sentAt?: string
  expiresAt?: string
  createdAt: string
  notes?: string
}

export interface SuperAdminStats {
  mrr: MRRSummary
  shops: ShopOverview[]
  proposals: Proposal[]
  revenueHistory: { month: string; revenue: number; mrr: number }[]
}
