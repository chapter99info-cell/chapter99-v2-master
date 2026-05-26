import { formatAUD } from './payidCalc'

export interface PaymentAlertDetails {
  client_name: string
  trip_code: string
  amount_aud: number
  payment_method: string
  reference_number: string
  booking_status?: string
}

/** Thai-friendly FB group post — copy/paste in ~30 seconds */
export function buildFbGroupPost(p: PaymentAlertDetails): string {
  const amount = formatAUD(p.amount_aud)
  const status = p.booking_status?.replace(/_/g, ' ') ?? 'PAID'
  return [
    '✅ รับชำระเงินแล้ว / Payment received',
    '',
    `🧳 ทัวร์: ${p.trip_code}`,
    `👤 ลูกทริป: ${p.client_name}`,
    `💰 จำนวน: ${amount}`,
    `💳 ช่องทาง: ${p.payment_method}`,
    `📋 สถานะ: ${status}`,
    `🔖 Ref: ${p.reference_number}`,
    '',
    '— Trip2Talk',
  ].join('\n')
}
