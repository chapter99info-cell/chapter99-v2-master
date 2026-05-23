import { supabase } from './supabase'

export interface LastCustomerVisit {
  daysAgo: number
  serviceLabel: string
  total: number
  paidAt: string
}

export async function fetchLastCustomerVisit(
  shopId: string,
  email: string
): Promise<LastCustomerVisit | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized) return null

  const { data, error } = await supabase
    .from('transactions')
    .select('paid_at, items, payment, client_email')
    .eq('shop_id', shopId)
    .eq('status', 'paid')
    .ilike('client_email', normalized)
    .order('paid_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error || !data?.paid_at) return null

  const paidAt = data.paid_at as string
  const paidDate = new Date(paidAt)
  const daysAgo = Math.max(
    0,
    Math.floor((Date.now() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
  )

  const items = (data.items ?? []) as { serviceName?: string }[]
  const serviceLabel =
    items.map(i => i.serviceName).filter(Boolean).join(', ') || 'Visit'

  const payment = data.payment as { total?: number } | null
  const total = Number(payment?.total ?? 0)

  return { daysAgo, serviceLabel, total, paidAt }
}
