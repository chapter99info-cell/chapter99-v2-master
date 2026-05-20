import { SHOP_ID, supabase } from './supabase'
import type { GiftVoucher, GiftVoucherPurchasedVia, ValidatedVoucher } from '../types/giftVoucher'

function mapRow(row: Record<string, unknown>): GiftVoucher {
  return {
    id: row.id as string,
    code: row.code as string,
    originalAmount: Number(row.original_amount),
    remainingBalance: Number(row.remaining_balance),
    expiryDate: row.expiry_date as string,
    status: row.status as GiftVoucher['status'],
    purchasedVia: row.purchased_via as GiftVoucher['purchasedVia'],
    buyerName: (row.buyer_name as string) || undefined,
    buyerEmail: (row.buyer_email as string) || undefined,
    shopId: row.shop_id as string,
    createdAt: row.created_at as string,
  }
}

function oneYearFromToday(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() + 1)
  return d.toISOString().slice(0, 10)
}

export async function fetchGiftVouchers(shopId = SHOP_ID): Promise<GiftVoucher[]> {
  const { data, error } = await supabase
    .from('gift_vouchers')
    .select('*')
    .eq('shop_id', shopId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data ?? []).map(mapRow)
}

export async function sellGiftVoucher(params: {
  amount: number
  buyerName: string
  buyerEmail?: string
  purchasedVia?: GiftVoucherPurchasedVia
  shopId?: string
}): Promise<GiftVoucher> {
  const shopId = params.shopId ?? SHOP_ID
  const amount = Math.round(params.amount * 100) / 100

  if (amount <= 0) throw new Error('Amount must be greater than zero')
  if (!params.buyerName.trim()) throw new Error('Buyer name is required')

  const { data, error } = await supabase
    .from('gift_vouchers')
    .insert({
      shop_id: shopId,
      original_amount: amount,
      remaining_balance: amount,
      expiry_date: oneYearFromToday(),
      status: 'active',
      purchased_via: params.purchasedVia ?? 'pos',
      buyer_name: params.buyerName.trim(),
      buyer_email: params.buyerEmail?.trim() || null,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return mapRow(data)
}

export async function validateGiftVoucher(
  code: string,
  shopId = SHOP_ID
): Promise<{ ok: true; voucher: ValidatedVoucher } | { ok: false; error: string }> {
  const trimmed = code.trim()
  if (!trimmed) return { ok: false, error: 'Enter a voucher code' }

  const { data, error } = await supabase.rpc('validate_gift_voucher', {
    p_code: trimmed,
    p_shop_id: shopId,
  })

  if (error) return { ok: false, error: error.message }

  const result = data as {
    valid: boolean
    error?: string
    code?: string
    original_amount?: number
    remaining_balance?: number
    expiry_date?: string
    status?: ValidatedVoucher['status']
    buyer_name?: string
  }

  if (!result?.valid) {
    return { ok: false, error: result?.error ?? 'Invalid voucher' }
  }

  return {
    ok: true,
    voucher: {
      code: result.code!,
      originalAmount: Number(result.original_amount),
      remainingBalance: Number(result.remaining_balance),
      expiryDate: result.expiry_date!,
      status: result.status!,
      buyerName: result.buyer_name || undefined,
    },
  }
}

export async function redeemGiftVoucher(
  code: string,
  amount: number,
  shopId = SHOP_ID
): Promise<
  | { ok: true; deducted: number; remainingBalance: number; status: string }
  | { ok: false; error: string }
> {
  const { data, error } = await supabase.rpc('redeem_gift_voucher', {
    p_code: code.trim(),
    p_shop_id: shopId,
    p_amount: Math.round(amount * 100) / 100,
  })

  if (error) return { ok: false, error: error.message }

  const result = data as {
    success: boolean
    error?: string
    deducted?: number
    remaining_balance?: number
    status?: string
  }

  if (!result?.success) {
    return { ok: false, error: result?.error ?? 'Redemption failed' }
  }

  return {
    ok: true,
    deducted: Number(result.deducted),
    remainingBalance: Number(result.remaining_balance),
    status: result.status ?? 'active',
  }
}

export function formatVoucherExpiry(dateStr: string): string {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
