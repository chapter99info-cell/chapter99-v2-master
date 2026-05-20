export type GiftVoucherStatus = 'active' | 'redeemed' | 'expired'
export type GiftVoucherPurchasedVia = 'web' | 'pos'

export interface GiftVoucher {
  id: string
  code: string
  originalAmount: number
  remainingBalance: number
  expiryDate: string
  status: GiftVoucherStatus
  purchasedVia: GiftVoucherPurchasedVia
  buyerName?: string
  buyerEmail?: string
  shopId: string
  createdAt: string
}

export interface ValidatedVoucher {
  code: string
  originalAmount: number
  remainingBalance: number
  expiryDate: string
  status: GiftVoucherStatus
  buyerName?: string
}

export const VOUCHER_PRESET_AMOUNTS = [50, 100, 150] as const
