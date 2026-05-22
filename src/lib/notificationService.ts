// Chapter99 — booking notifications (Alerts panel)

import type { SupabaseClient } from '@supabase/supabase-js'
import {
  mapRowToNotification,
  type AppNotification,
  type NotificationRow,
} from '../types/notification'

const BOOKING_LOOKBACK_DAYS = 14

export async function fetchBookingNotifications(
  supabase: SupabaseClient,
  shopId: string
): Promise<AppNotification[]> {
  const since = new Date()
  since.setDate(since.getDate() - BOOKING_LOOKBACK_DAYS)

  const { data, error } = await supabase
    .from('notifications')
    .select('id, shop_id, booking_id, message, is_read, created_at')
    .eq('shop_id', shopId)
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) throw new Error(error.message)
  return ((data ?? []) as NotificationRow[])
    .map(mapRowToNotification)
    .filter(n => n.payload?.type === 'booking')
}

export async function countUnreadNotifications(
  supabase: SupabaseClient,
  shopId: string
): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('shop_id', shopId)
    .eq('is_read', false)

  if (error) throw new Error(error.message)
  return count ?? 0
}

export async function markAllNotificationsRead(
  supabase: SupabaseClient,
  shopId: string
): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('shop_id', shopId)
    .eq('is_read', false)

  if (error) throw new Error(error.message)
}

export function formatNotificationDateTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function therapistLabel(therapist: string | null | undefined): string {
  return therapist?.trim() ? therapist.trim() : 'No preference'
}

export function roomLabel(room: string | null | undefined): string {
  return room?.trim() ? room.trim() : 'Unassigned'
}
