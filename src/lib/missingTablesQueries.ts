import { supabase } from './supabase'
import type {
  ClientGuideContentRow,
  EmergencyContactRow,
  GalleryRow,
  GuideTabType,
  ItineraryBundle,
  OfflineMapPinRow,
  PackingItemRow,
  ReviewAggregate,
  ReviewWithClient,
  Season,
} from '../types/missing_tables'
import type { TourDestination } from '../types/tour'

export async function fetchGuideContent(
  tabType: GuideTabType,
  dest?: TourDestination | string | null
): Promise<ClientGuideContentRow[]> {
  let q = supabase
    .from('client_guide_content')
    .select('*')
    .eq('tab_type', tabType)
    .order('sort_order', { ascending: true })

  if (dest) q = q.eq('dest', dest)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as ClientGuideContentRow[]
}

export async function fetchPublishedReviews(opts?: {
  limit?: number
  dest?: string
}): Promise<ReviewWithClient[]> {
  const limit = opts?.limit ?? 10
  const { data, error } = await supabase
    .from('reviews')
    .select(
      `
      id, client_id, tour_id, rating, title_en, title_th, body_en, body_th,
      is_published, created_at,
      crm_clients (
        first_name_th, last_name_th, first_name_en, last_name_en,
        client_tier, university
      )
    `
    )
    .eq('is_published', true)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => {
    const c = row.crm_clients as Record<string, unknown> | null
    return {
      id: row.id as string,
      client_id: row.client_id as string,
      tour_id: row.tour_id as string | null,
      rating: row.rating as number,
      title_en: row.title_en as string | null,
      title_th: row.title_th as string | null,
      body_en: row.body_en as string,
      body_th: row.body_th as string,
      is_published: true,
      created_at: row.created_at as string,
      full_name_th: c ? `${c.first_name_th} ${c.last_name_th}` : '',
      full_name_en: c ? `${c.first_name_en} ${c.last_name_en}` : '',
      client_tier: (c?.client_tier as ReviewWithClient['client_tier']) ?? 'STANDARD',
      university: (c?.university as string | null) ?? null,
    }
  })
}

export async function fetchReviewAggregate(): Promise<ReviewAggregate> {
  const { data, error } = await supabase
    .from('reviews')
    .select('rating')
    .eq('is_published', true)

  if (error) throw new Error(error.message)

  const breakdown: ReviewAggregate['breakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let sum = 0
  for (const r of data ?? []) {
    const rating = Math.min(5, Math.max(1, Math.round(Number(r.rating)))) as 1 | 2 | 3 | 4 | 5
    breakdown[rating] += 1
    sum += rating
  }
  const total = data?.length ?? 0
  return {
    average_rating: total ? sum / total : 0,
    total_count: total,
    breakdown,
  }
}

export async function fetchGallery(opts?: {
  limit?: number
  dest?: string
}): Promise<GalleryRow[]> {
  const limit = opts?.limit ?? 12
  let q = supabase
    .from('gallery')
    .select('id, tour_id, dest, public_url, caption_en, caption_th, like_count, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (opts?.dest) q = q.eq('dest', opts.dest)

  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as GalleryRow[]
}

export async function toggleGalleryLike(
  galleryId: string,
  clientId: string
): Promise<{ liked: boolean; like_count: number }> {
  const { data: existing } = await supabase
    .from('gallery_likes')
    .select('id')
    .eq('gallery_id', galleryId)
    .eq('client_id', clientId)
    .maybeSingle()

  if (existing?.id) {
    await supabase.from('gallery_likes').delete().eq('id', existing.id)
  } else {
    await supabase.from('gallery_likes').insert({ gallery_id: galleryId, client_id: clientId })
  }

  const { count } = await supabase
    .from('gallery_likes')
    .select('*', { count: 'exact', head: true })
    .eq('gallery_id', galleryId)

  const likeCount = count ?? 0
  await supabase.from('gallery').update({ like_count: likeCount }).eq('id', galleryId)

  return { liked: !existing?.id, like_count: likeCount }
}

export function subscribeToGalleryLikes(onChange: () => void): () => void {
  const channel = supabase
    .channel('gallery_likes_live')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'gallery_likes' },
      () => onChange()
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function fetchPackingItems(opts: {
  dest: TourDestination | string
  season: Season
}): Promise<PackingItemRow[]> {
  const { data, error } = await supabase
    .from('packing_items')
    .select('*')
    .eq('dest', opts.dest)
    .eq('season', opts.season)
    .order('category')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as PackingItemRow[]
}

export async function fetchItinerary(tourId: string): Promise<ItineraryBundle> {
  const { data: days, error: dayErr } = await supabase
    .from('tour_itinerary_days')
    .select('*')
    .eq('tour_id', tourId)
    .order('day_number', { ascending: true })

  if (dayErr) throw new Error(dayErr.message)
  const dayIds = (days ?? []).map((d) => d.id as string)
  if (!dayIds.length) return { days: [], blocks: [] }

  const { data: blocks, error: blockErr } = await supabase
    .from('tour_itinerary_blocks')
    .select('*')
    .in('day_id', dayIds)
    .order('sort_order', { ascending: true })

  if (blockErr) throw new Error(blockErr.message)

  return {
    days: days ?? [],
    blocks: blocks ?? [],
  }
}

export function subscribeToItinerary(tourId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`itinerary_${tourId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tour_itinerary_days', filter: `tour_id=eq.${tourId}` },
      () => onChange()
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'tour_itinerary_blocks' },
      () => onChange()
    )
    .subscribe()

  return () => {
    void supabase.removeChannel(channel)
  }
}

export async function fetchOfflineMapPins(
  dest: TourDestination | string
): Promise<OfflineMapPinRow[]> {
  const { data, error } = await supabase
    .from('offline_map_pins')
    .select('*')
    .eq('dest', dest)
    .order('category')
    .order('sort_order', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as OfflineMapPinRow[]
}

export async function fetchEmergencyContacts(
  dest: TourDestination | string
): Promise<EmergencyContactRow[]> {
  const { data, error } = await supabase
    .from('emergency_contacts')
    .select('*')
    .eq('dest', dest)
    .order('priority', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as EmergencyContactRow[]
}

export function seasonFromStartDate(
  startDate: string,
  dest: TourDestination | string
): Season {
  const month = new Date(startDate).getMonth() + 1
  const southern = dest === 'New Zealand' || dest === 'Sydney'
  if (!southern) {
    if (month >= 12 || month <= 2) return 'winter'
    if (month >= 3 && month <= 5) return 'spring'
    if (month >= 6 && month <= 8) return 'summer'
    return 'autumn'
  }
  if (month === 12 || month <= 2) return 'summer'
  if (month >= 3 && month <= 5) return 'autumn'
  if (month >= 6 && month <= 8) return 'winter'
  return 'spring'
}
