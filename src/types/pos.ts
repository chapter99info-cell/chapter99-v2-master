// Chapter99 V4 — Phase 5 POS Types
// All monetary values in AUD cents to avoid float errors

export type PaymentMethod = 'cash' | 'payid' | 'card' | 'hicaps' | 'amex'

export type BillStatus = 'open' | 'paid' | 'voided' | 'refunded'

export interface Service {
  id: string
  name: string
  nameEn: string
  duration: number        // minutes
  price: number           // AUD dollars
  gstFree: boolean        // Remedial Massage = GST-free in AU
  itemNo?: string         // Health Fund Item No (e.g. "205")
  category: string
}

export interface BillItem {
  serviceId: string
  serviceName: string
  duration: number
  price: number
  gstFree: boolean
  itemNo?: string
}

export interface PaymentBreakdown {
  subtotal: number        // gross total
  gstFreeAmt: number      // portion that is GST-free
  taxableAmt: number      // subtotal - gstFreeAmt
  gst: number             // taxableAmt / 11
  exGst: number           // subtotal - gst
  surcharge: number       // card surcharge 1.5%
  surchargeRate: number   // 0.015 for card
  total: number           // final charge to customer
  gpCost: number          // actual card processing cost
  netRevenue: number      // total - gpCost
}

export interface Transaction {
  id: string              // e.g. "TBM-2026-00123"
  shopId: string
  bookingId?: string      // if from booking
  clientName?: string
  clientEmail?: string
  therapistId?: string
  therapistName?: string
  items: BillItem[]
  payment: PaymentBreakdown
  paymentMethod: PaymentMethod
  status: BillStatus
  createdAt: string       // ISO string
  paidAt?: string
  voidedAt?: string
  voidReason?: string
  receiptSent: boolean
  healthFundIssued: boolean
  voucherCode?: string
  voucherAmount?: number
}

export interface Staff {
  id: string
  nameEn: string
  nameTh: string
  role: 'therapist' | 'cashier' | 'manager' | 'owner'
  commissionRate: number  // 0.45 = 45%
  pin: string             // hashed
  active: boolean
}

export interface Shop {
  id: string
  name: string
  abn: string
  address: string
  phone: string
  email: string
  gstRegistered: boolean
  currency: 'AUD'
  timezone: string
  logoUrl?: string
  themeColor: string
  // Health Fund
  providerName: string
  providerNumber: string
  signatureUrl?: string
  // Payment
  cardSurchargeRate: number   // 0.015
  amexSurchargeRate: number   // 0.02
  stripePublicKey?: string
  payidBsb?: string
  payidAccount?: string
  googleSheetUrl?: string
  googleSheetSyncEnabled?: boolean
  googleReviewUrl?: string
}

export interface ReceiptRecord {
  id: string
  shopId: string
  transactionId: string
  receiptNumber: string
  clientName?: string
  clientEmail?: string
  paymentMethod: string
  total: number
  pdfUrl?: string
  emailSent: boolean
  healthFund: boolean
  issuedAt: string
}

export const THEME_PRESETS = [
  { id: 'green', label: 'Forest Green', hex: '#0F6E56' },
  { id: 'blue', label: 'Ocean Blue', hex: '#1E6FD9' },
  { id: 'gold', label: 'Warm Gold', hex: '#C9A227' },
  { id: 'purple', label: 'Royal Purple', hex: '#6B4E9B' },
  { id: 'terracotta', label: 'Terracotta', hex: '#993C1D' },
] as const
