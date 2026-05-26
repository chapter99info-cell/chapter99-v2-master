import { useCallback, useEffect, useState } from 'react'
import { buildFbGroupPost, type PaymentAlertDetails } from '../lib/fbPostTemplate'
import { formatAUD } from '../lib/payidCalc'
import {
  getStaffPushPermission,
  isStaffPushSupported,
  registerStaffPush,
  showLocalPaymentNotification,
} from '../lib/staffPush'
import { supabase } from '../lib/supabase'

export function useStaffPaymentAlerts(onPaymentRecorded?: () => void) {
  const [pushPermission, setPushPermission] = useState<NotificationPermission>('default')
  const [pushRegistering, setPushRegistering] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [lastPayment, setLastPayment] = useState<PaymentAlertDetails | null>(null)
  const [fbCopied, setFbCopied] = useState(false)

  const pushSupported = isStaffPushSupported()
  const vapidConfigured = Boolean(import.meta.env.VITE_VAPID_PUBLIC_KEY?.trim())

  useEffect(() => {
    void getStaffPushPermission().then(setPushPermission)
  }, [])

  const enablePush = useCallback(async () => {
    setPushRegistering(true)
    setPushError(null)
    const result = await registerStaffPush('GUIDE')
    setPushRegistering(false)
    if (result.ok) {
      setPushPermission('granted')
    } else {
      setPushError(result.error ?? 'Could not enable push')
    }
  }, [])

  const applyPaymentAlert = useCallback(
    (details: PaymentAlertDetails) => {
      setLastPayment(details)
      setFbCopied(false)
      onPaymentRecorded?.()

      const body = `${details.client_name} · ${formatAUD(details.amount_aud)} · ${details.trip_code}`
      showLocalPaymentNotification('💳 Payment received', body)
    },
    [onPaymentRecorded]
  )

  useEffect(() => {
    const channel = supabase
      .channel('staff_payment_alerts')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tour_bookings' },
        async (payload) => {
          const row = payload.new as {
            client_id?: string
            tour_id?: string
            amount_paid_aud?: number
            payment_method?: string
            booking_status?: string
            booked_at?: string
          }

          let clientName = 'Guest'
          let tripCode = '—'

          if (row.client_id) {
            const { data: client } = await supabase
              .from('crm_clients')
              .select('first_name_en, last_name_en, first_name_th, last_name_th')
              .eq('id', row.client_id)
              .maybeSingle()
            if (client) {
              const en = `${client.first_name_en ?? ''} ${client.last_name_en ?? ''}`.trim()
              const th = `${client.first_name_th ?? ''} ${client.last_name_th ?? ''}`.trim()
              clientName = en || th || clientName
            }
          }

          if (row.tour_id) {
            const { data: tour } = await supabase
              .from('tours')
              .select('trip_code')
              .eq('id', row.tour_id)
              .maybeSingle()
            if (tour?.trip_code) tripCode = tour.trip_code
          }

          const ref = `BK-${String(row.booked_at ?? Date.now()).slice(11, 19).replace(/\D/g, '')}`

          applyPaymentAlert({
            client_name: clientName,
            trip_code: tripCode,
            amount_aud: Number(row.amount_paid_aud ?? 0),
            payment_method: row.payment_method ?? '—',
            reference_number: ref,
            booking_status: row.booking_status,
          })
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [applyPaymentAlert])

  const copyFbPost = useCallback(async () => {
    if (!lastPayment) return
    const text = buildFbGroupPost(lastPayment)
    try {
      await navigator.clipboard.writeText(text)
      setFbCopied(true)
      window.setTimeout(() => setFbCopied(false), 2500)
    } catch {
      setPushError('Could not copy — select text manually')
    }
  }, [lastPayment])

  const fbPostText = lastPayment ? buildFbGroupPost(lastPayment) : ''

  return {
    pushSupported,
    vapidConfigured,
    pushPermission,
    pushRegistering,
    pushError,
    enablePush,
    lastPayment,
    fbPostText,
    fbCopied,
    copyFbPost,
    dismissPaymentAlert: () => setLastPayment(null),
  }
}
