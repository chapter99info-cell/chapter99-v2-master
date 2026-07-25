import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchSignageData,
  type SignageService,
} from '../lib/signageService'

const POLL_MS = 5 * 60 * 1000

/**
 * Live service prices for signage overlay.
 * Prefers Supabase Realtime on `services`; falls back to 5-minute poll when the
 * websocket is not subscribed.
 */
export function useSignagePrices(shopId: string | undefined) {
  const [services, setServices] = useState<SignageService[]>([])
  const [realtimeOk, setRealtimeOk] = useState(false)
  const pollRef = useRef<number | null>(null)

  const reload = useCallback(async () => {
    if (!shopId) return
    try {
      const data = await fetchSignageData(shopId)
      if (data.ok) setServices(data.services)
    } catch {
      /* keep last good overlay */
    }
  }, [shopId])

  useEffect(() => {
    if (!shopId) return
    void reload()

    const channel = supabase
      .channel(`signage-services-${shopId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'services',
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          void reload()
        }
      )
      .subscribe((status) => {
        setRealtimeOk(status === 'SUBSCRIBED')
      })

    return () => {
      setRealtimeOk(false)
      void supabase.removeChannel(channel)
    }
  }, [shopId, reload])

  useEffect(() => {
    if (!shopId) return

    const clearPoll = () => {
      if (pollRef.current != null) {
        window.clearInterval(pollRef.current)
        pollRef.current = null
      }
    }

    clearPoll()
    if (!realtimeOk) {
      pollRef.current = window.setInterval(() => {
        void reload()
      }, POLL_MS)
    }

    return clearPoll
  }, [shopId, realtimeOk, reload])

  return { services, realtimeOk, reload }
}
