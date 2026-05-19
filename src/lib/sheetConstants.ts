export const TRANSACTION_HEADERS = [
  'transaction_id',
  'date',
  'time',
  'services',
  'amount',
  'GST',
  'payment_method',
  'customer',
] as const

export const BOOKING_HEADERS = [
  'booking_id',
  'date',
  'time',
  'service',
  'customer',
  'phone',
  'status',
] as const

export const DAILY_SUMMARY_HEADERS = [
  'date',
  'total_revenue',
  'total_bookings',
  'payment_methods_breakdown',
] as const

export interface BookingSheetRow {
  bookingId: string
  date: string
  time: string
  service: string
  customer: string
  phone: string
  status: string
}
