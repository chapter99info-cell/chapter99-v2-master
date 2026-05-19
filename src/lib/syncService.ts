// Chapter99 V4 — Phase 5
// Background Sync: IndexedDB → Supabase
// Runs when network is restored

import { createClient } from '@supabase/supabase-js'
import { getPendingSync, markSynced, db } from './posDb'
import type { Transaction } from '../types/pos'

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

const MAX_RETRIES = 5

// Sync one transaction to Supabase
async function syncOne(tx: Transaction): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('transactions')
      .upsert({
        id: tx.id,
        shop_id: tx.shopId,
        booking_id: tx.bookingId ?? null,
        client_name: tx.clientName ?? null,
        client_email: tx.clientEmail ?? null,
        therapist_id: tx.therapistId ?? null,
        items: tx.items,
        payment: tx.payment,
        payment_method: tx.paymentMethod,
        status: tx.status,
        created_at: tx.createdAt,
        paid_at: tx.paidAt ?? null,
        voided_at: tx.voidedAt ?? null,
        void_reason: tx.voidReason ?? null,
        receipt_sent: tx.receiptSent,
        health_fund_issued: tx.healthFundIssued,
      })

    if (error) throw error
    return true
  } catch (err) {
    console.error('[Sync] Failed to sync:', tx.id, err)
    return false
  }
}

// Main sync loop
export async function syncPending(): Promise<{
  synced: number
  failed: number
}> {
  if (!navigator.onLine) return { synced: 0, failed: 0 }

  const pending = await getPendingSync()
  let synced = 0
  let failed = 0

  for (const tx of pending) {
    const ok = await syncOne(tx)
    if (ok) {
      await markSynced(tx.id)
      synced++
    } else {
      // Increment retry count
      const record = await db.pendingSync.get(tx.id)
      if (record) {
        const retries = record.retries + 1
        if (retries >= MAX_RETRIES) {
          // Give up — flag for manual review
          console.error('[Sync] Max retries reached for:', tx.id)
          await db.pendingSync.update(tx.id, {
            retries,
            lastAttempt: new Date().toISOString(),
          })
        } else {
          await db.pendingSync.update(tx.id, {
            retries,
            lastAttempt: new Date().toISOString(),
          })
        }
      }
      failed++
    }
  }

  return { synced, failed }
}

// Auto-sync when network comes back
export function startSyncListener(): () => void {
  const handler = () => {
    console.log('[Sync] Network restored — syncing...')
    syncPending().then(({ synced, failed }) => {
      console.log(`[Sync] Done: ${synced} synced, ${failed} failed`)
    })
  }
  window.addEventListener('online', handler)
  // Also sync on load if online
  if (navigator.onLine) syncPending()
  // Return cleanup function
  return () => window.removeEventListener('online', handler)
}

// Check sync status
export async function getSyncStatus(): Promise<{
  pending: number
  isOnline: boolean
}> {
  const count = await db.pendingSync.count()
  return { pending: count, isOnline: navigator.onLine }
}
