import type { Shop } from '../types/pos'

export type DepositType = 'percent' | 'fixed'

export interface DepositSettings {
  depositEnabled: boolean
  depositType: DepositType
  depositPercent: number
  depositFixedAmount: number
  depositRefundHours: number
}

export function shopDepositSettings(shop: Shop): DepositSettings {
  return {
    depositEnabled: shop.depositEnabled === true,
    depositType: shop.depositType === 'fixed' ? 'fixed' : 'percent',
    depositPercent: shop.depositPercent ?? 20,
    depositFixedAmount: shop.depositFixedAmount ?? 20,
    depositRefundHours: shop.depositRefundHours ?? 24,
  }
}

export function isShopStripeEnabled(shop: Shop): boolean {
  return shop.addonStripe === true && Boolean(shop.stripePublicKey?.trim())
}

export function requiresOnlineDeposit(shop: Shop): boolean {
  const cfg = shopDepositSettings(shop)
  return cfg.depositEnabled && isShopStripeEnabled(shop)
}

/** Deposit amount in AUD (min $0.50, capped at service price). */
export function calculateDepositAmount(
  servicePrice: number,
  cfg: DepositSettings
): number {
  if (!cfg.depositEnabled || servicePrice <= 0) return 0

  let amount =
    cfg.depositType === 'fixed'
      ? cfg.depositFixedAmount
      : Math.round(((servicePrice * cfg.depositPercent) / 100) * 100) / 100

  amount = Math.min(amount, servicePrice)
  amount = Math.max(0.5, amount)
  return Math.round(amount * 100) / 100
}

export function formatAud(amount: number): string {
  return `$${amount.toFixed(2)}`
}
