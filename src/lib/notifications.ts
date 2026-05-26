import { supabase } from './supabase'

export interface NotificationPayload {
  client_name: string
  client_email?: string
  client_phone?: string
  trip_code: string
  amount_aud?: number
  reference_number?: string
  payment_method?: string
  booking_status?: string
}

export interface TransactionNotificationResult {
  success: boolean
  error?: string
  email?: boolean
  staff_push_sent?: number
}

/** Email receipt (Resend) + staff Web Push — triggered after tour_bookings payment */
export async function dispatchTransactionNotification(
  payload: NotificationPayload
): Promise<TransactionNotificationResult> {
  try {
    const { data, error } = await supabase.functions.invoke('send-trip-receipt', {
      body: {
        ...payload,
        client_email: payload.client_email ?? '',
        client_phone: payload.client_phone ?? '',
        amount_aud: payload.amount_aud ?? 0,
        reference_number: payload.reference_number ?? payload.trip_code,
        payment_method: payload.payment_method ?? 'onboarding',
      },
    })
    if (error) throw error
    const results = (data as { results?: { email?: boolean; staff_push?: { sent?: number } } })
      ?.results
    console.info('[Trip2Talk] Payment notifications:', data)
    return {
      success: true,
      email: results?.email,
      staff_push_sent: results?.staff_push?.sent,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Trip2Talk] Notification skipped:', message)
    return { success: false, error: message }
  }
}
