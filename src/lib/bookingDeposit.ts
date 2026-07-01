import type { Shop } from '../types/pos'

export type DepositMode = 'off' | 'all' | 'new_customers_only' | 'weekends_only'

export interface DepositEvaluationContext {
  selectedDate: Date
  clientVisitCount?: number
}

export function shopDepositMode(shop: Shop): DepositMode {
  const mode = shop.depositMode as DepositMode | undefined
  if (mode && ['off', 'all', 'new_customers_only', 'weekends_only'].includes(mode)) {
    return mode
  }
  return shop.depositEnabled ? 'all' : 'off'
}

export function isShopStripeEnabled(shop: Shop): boolean {
  return shop.addonStripe === true && Boolean(shop.stripePublicKey?.trim())
}

export function evaluateDepositRequired(
  shop: Shop,
  ctx: DepositEvaluationContext
): boolean {
  const mode = shopDepositMode(shop)
  if (mode === 'off' || !isShopStripeEnabled(shop)) return false
  if (mode === 'all') return true
  if (mode === 'new_customers_only') {
    const threshold = shop.depositNewCustomerThreshold ?? 1
    return (ctx.clientVisitCount ?? 0) < threshold
  }
  if (mode === 'weekends_only') {
    const day = ctx.selectedDate.getDay()
    return day === 0 || day === 6
  }
  return false
}

export function requiresOnlineDeposit(
  shop: Shop,
  ctx?: DepositEvaluationContext
): boolean {
  if (!ctx) {
    return shopDepositMode(shop) !== 'off' && isShopStripeEnabled(shop)
  }
  return evaluateDepositRequired(shop, ctx)
}

export function depositAmountForShop(shop: Shop, servicePrice: number): number {
  const amount = Number(shop.depositAmount ?? shop.depositFixedAmount ?? 20)
  if (amount <= 0 || servicePrice <= 0) return 0
  return Math.min(Math.max(0.5, amount), servicePrice)
}

export function shopDepositSettings(shop: Shop) {
  return {
    depositMode: shopDepositMode(shop),
    depositAmount: shop.depositAmount ?? 20,
    depositCancelHours: shop.depositCancelHours ?? shop.depositRefundHours ?? 24,
    depositNewCustomerThreshold: shop.depositNewCustomerThreshold ?? 1,
    depositEnabled: shopDepositMode(shop) !== 'off',
    depositType: shop.depositType === 'fixed' ? 'fixed' as const : 'percent' as const,
    depositPercent: shop.depositPercent ?? 20,
    depositFixedAmount: shop.depositFixedAmount ?? 20,
    depositRefundHours: shop.depositRefundHours ?? 24,
  }
}

/** @deprecated use depositAmountForShop */
export function calculateDepositAmount(
  servicePrice: number,
  cfg: { depositEnabled: boolean; depositType: 'percent' | 'fixed'; depositPercent: number; depositFixedAmount: number }
): number {
  if (!cfg.depositEnabled || servicePrice <= 0) return 0
  let amount =
    cfg.depositType === 'fixed'
      ? cfg.depositFixedAmount
      : Math.round(((servicePrice * cfg.depositPercent) / 100) * 100) / 100
  amount = Math.min(amount, servicePrice)
  return Math.max(0.5, Math.round(amount * 100) / 100)
}

export function formatAud(amount: number): string {
  return `$${amount.toFixed(2)}`
}
