import { filterAllowedTours } from './tripFilters'
import { isSupabaseConfigured, supabase } from './supabase'
import type { Tour } from '../types/tour'

/** Shown only when Supabase is unreachable and no tours return (UI smoke test). */
export const PUBLIC_TOURS_FALLBACK: Tour[] = [
  {
    id: 'fallback-nz-aut-2026',
    trip_code: 'NZ-AUT-2026',
    destination: 'New Zealand',
    start_date: '2026-06-15',
    end_date: '2026-06-28',
    price_aud: 2499,
    max_pax: 20,
    current_pax: 0,
    status: 'CONFIRMED',
    base_commission_rate: 0,
    bonus_threshold_pax: 0,
    bonus_amount_aud: 0,
  },
]

/** NZ + Sydney tours for client TRIP tab (matches onboarding). */
export async function fetchPublicTours(): Promise<Tour[]> {
  if (!isSupabaseConfigured) {
    return [...PUBLIC_TOURS_FALLBACK]
  }

  const queries = [
    supabase.from('tours').select('*').eq('status', 'CONFIRMED').order('start_date', { ascending: true }),
    supabase
      .from('tours')
      .select('*')
      .in('status', ['CONFIRMED', 'ACTIVE', 'PLANNING'])
      .order('start_date', { ascending: true }),
    supabase.from('tours').select('*').neq('status', 'CANCELLED').order('start_date', { ascending: true }),
  ] as const

  for (const query of queries) {
    const { data, error } = await query
    if (error) {
      console.warn('[Trip2Talk] fetchPublicTours:', error.message)
      continue
    }
    const allowed = filterAllowedTours((data ?? []) as Tour[])
    if (allowed.length > 0) return allowed
  }

  return []
}
