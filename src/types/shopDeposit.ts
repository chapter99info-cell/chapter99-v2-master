export type DepositType = 'percent' | 'fixed'

export interface ShopDepositSettings {
  shopId: string
  depositEnabled: boolean
  depositType: DepositType
  depositPercent: number
  depositFixedAmount: number
  depositRefundHours: number
  addonStripe: boolean
  stripeConfigured: boolean
}

export interface DepositMonthStats {
  collected: number
  pending: number
  refunds: number
}

export function defaultDepositSettings(shopId: string): ShopDepositSettings {
  return {
    shopId,
    depositEnabled: false,
    depositType: 'percent',
    depositPercent: 20,
    depositFixedAmount: 20,
    depositRefundHours: 24,
    addonStripe: false,
    stripeConfigured: false,
  }
}

export function rowToDepositSettings(row: Record<string, unknown>): ShopDepositSettings {
  const shopId = String(row.id ?? '')
  return {
    shopId,
    depositEnabled: row.deposit_enabled === true,
    depositType: row.deposit_type === 'fixed' ? 'fixed' : 'percent',
    depositPercent: Number(row.deposit_percent ?? 20),
    depositFixedAmount: Number(row.deposit_fixed_amount ?? 20),
    depositRefundHours: Number(row.deposit_refund_hours ?? 24),
    addonStripe: row.addon_stripe === true,
    stripeConfigured: Boolean(String(row.stripe_pub_key ?? '').trim()),
  }
}

export function depositSettingsToRow(input: ShopDepositSettings) {
  return {
    deposit_enabled: input.depositEnabled,
    deposit_type: input.depositType,
    deposit_percent: input.depositPercent,
    deposit_fixed_amount: input.depositFixedAmount,
    deposit_refund_hours: input.depositRefundHours,
  }
}
