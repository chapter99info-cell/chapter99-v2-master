// Chapter99 V4 — Phase 5
// Offline-first POS Storage (Dexie.js / IndexedDB)
// Transactions saved locally → sync to Supabase when online

import Dexie, { type Table } from 'dexie'
import type { Transaction, BillItem } from '../types/pos'

export class POSDatabase extends Dexie {
  transactions!: Table<Transaction>
  pendingSync!: Table<{ id: string; retries: number; lastAttempt: string }>

  constructor() {
    super('chapter99_pos')
    this.version(1).stores({
      transactions: 'id, shopId, status, createdAt, paymentMethod, paidAt',
      pendingSync: 'id, retries, lastAttempt',
    })
  }
}

export const db = new POSDatabase()

// Save transaction locally (always succeeds offline)
export async function saveTransaction(tx: Transaction): Promise<void> {
  await db.transactions.put(tx)
  // Mark for sync
  await db.pendingSync.put({
    id: tx.id,
    retries: 0,
    lastAttempt: new Date().toISOString(),
  })
}

// Get all unsynced transactions
export async function getPendingSync(): Promise<Transaction[]> {
  const pending = await db.pendingSync.toArray()
  const ids = pending.map(p => p.id)
  return db.transactions.where('id').anyOf(ids).toArray()
}

// Mark transaction as synced (remove from pending)
export async function markSynced(id: string): Promise<void> {
  await db.pendingSync.delete(id)
}

// Get transactions for current day (for dashboard)
export async function getTodayTransactions(shopId: string): Promise<Transaction[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return db.transactions
    .where('shopId').equals(shopId)
    .and(tx => new Date(tx.createdAt) >= today)
    .toArray()
}

// Get transaction by ID
export async function getTransaction(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id)
}

// Void transaction
export async function voidTransaction(
  id: string,
  reason: string
): Promise<void> {
  await db.transactions.update(id, {
    status: 'voided',
    voidedAt: new Date().toISOString(),
    voidReason: reason,
  })
  await db.pendingSync.put({
    id,
    retries: 0,
    lastAttempt: new Date().toISOString(),
  })
}
