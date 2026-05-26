import type { Expense } from '../types/tour'

const DB_NAME = 'Trip2Talk_Offline_DB'

export function initDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 2)
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('receipts')) {
        db.createObjectStore('receipts', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('expense_metadata')) {
        db.createObjectStore('expense_metadata', { keyPath: 'id' })
      }
    }
  })
}

export async function saveExpenseLocally(expense: Expense, blob: Blob): Promise<void> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['receipts', 'expense_metadata'], 'readwrite')
    tx.onerror = () => reject(tx.error)
    tx.objectStore('receipts').put({ id: expense.id, blob })
    tx.objectStore('expense_metadata').put({ ...expense, is_synced: false })
    tx.oncomplete = () => resolve()
  })
}

export async function getAllLocalExpenses(): Promise<Expense[]> {
  const db = await initDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction('expense_metadata', 'readonly')
    const req = tx.objectStore('expense_metadata').getAll()
    req.onerror = () => reject(req.error)
    req.onsuccess = () => resolve((req.result as Expense[]) ?? [])
  })
}
