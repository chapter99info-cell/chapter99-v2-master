import type { ClientArchiveRecord } from '../types/archive'
import type { Expense, Tour } from '../types/tour'
import { supabase } from './supabase'

const TAX_YEAR_SHEET = 'Tax_Year_2025_2026'

export interface SettlementSyncPayload {
  tourCode: string
  revenue: number
  expenses: number
  commissions: number
  netProfit: number
  gstCollected: number
  gstClaimed: number
  syncedAt: string
}

function expenseToSheetPayload(expense: Expense, fileData = '') {
  return {
    id: expense.id,
    tourId: expense.tour_id ?? '',
    vendor: expense.vendor_name,
    category: expense.ato_category,
    amountAud: expense.amount_aud,
    hasGst: expense.has_gst,
    gstAmount: expense.gst_amount_aud,
    filename: expense.receipt_filename,
    createdAt: expense.created_at,
    fileData,
  }
}

export async function syncExpenseToGoogleWorkspace(
  expense: Expense,
  receiptBlob: Blob | null
): Promise<{ success: boolean; error?: string; spreadsheetUrl?: string }> {
  try {
    let base64File = ''
    if (receiptBlob) {
      base64File = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const result = reader.result as string
          resolve(result.split(',')[1] ?? '')
        }
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(receiptBlob)
      })
    }

    const { data, error } = await supabase.functions.invoke('google-workspace-sync', {
      body: {
        action: 'SYNC_EXPENSE',
        taxYear: TAX_YEAR_SHEET,
        payload: expenseToSheetPayload(expense, base64File),
      },
    })

    if (error) throw error
    if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
      throw new Error((data as { error?: string }).error ?? 'Google sync failed')
    }

    return {
      success: true,
      spreadsheetUrl: (data as { spreadsheetUrl?: string })?.spreadsheetUrl,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Trip2Talk] Google expense sync skipped:', message)
    return { success: false, error: message }
  }
}

export async function syncSettlementToGoogleSheets(
  payload: SettlementSyncPayload
): Promise<{ success: boolean; error?: string; spreadsheetUrl?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('google-workspace-sync', {
      body: {
        action: 'SYNC_SETTLEMENT',
        taxYear: TAX_YEAR_SHEET,
        payload,
      },
    })

    if (error) throw error
    if (data && typeof data === 'object' && 'success' in data && !(data as { success: boolean }).success) {
      throw new Error((data as { error?: string }).error ?? 'Google settlement sync failed')
    }

    return {
      success: true,
      spreadsheetUrl: (data as { spreadsheetUrl?: string })?.spreadsheetUrl,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Trip2Talk] Google settlement sync skipped:', message)
    return { success: false, error: message }
  }
}

export function buildSettlementForTour(
  tour: Tour,
  bookings: { tour_id: string; amount_paid_aud: number }[],
  expenses: Expense[]
): SettlementSyncPayload {
  const revenue = bookings
    .filter((b) => b.tour_id === tour.id)
    .reduce((s, b) => s + b.amount_paid_aud, 0)

  const tourExpenses = expenses.filter(
    (e) => e.tour_id === tour.id || e.tour_id === tour.trip_code
  )
  const expenseTotal = tourExpenses.reduce((s, e) => s + e.amount_aud, 0)
  const gstClaimed = tourExpenses.reduce((s, e) => s + e.gst_amount_aud, 0)
  const commissions =
    tour.current_pax * tour.base_commission_rate +
    (tour.current_pax >= tour.bonus_threshold_pax ? tour.bonus_amount_aud : 0)

  return {
    tourCode: tour.trip_code,
    revenue,
    expenses: expenseTotal,
    commissions,
    netProfit: revenue - expenseTotal - commissions,
    gstCollected: revenue / 11,
    gstClaimed,
    syncedAt: new Date().toISOString(),
  }
}

export async function syncClientArchiveToGoogleSheets(
  record: ClientArchiveRecord
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('google-workspace-sync', {
      body: { action: 'archive_client', record },
    })
    if (error) throw error
    return { success: true }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[Trip2Talk] Google archive sync skipped:', message)
    return { success: false, error: message }
  }
}
