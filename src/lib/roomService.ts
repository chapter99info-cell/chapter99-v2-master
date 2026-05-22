// Chapter99 — rooms CRUD (Owner settings + queue / wizard)

import type { SupabaseClient } from '@supabase/supabase-js'
import { mapRowToRoom, type Room, type RoomRow } from '../types/room'

export async function fetchRooms(
  supabase: SupabaseClient,
  shopId: string,
  opts?: { activeOnly?: boolean }
): Promise<Room[]> {
  let query = supabase
    .from('rooms')
    .select('id, shop_id, name, active, created_at')
    .eq('shop_id', shopId)
    .order('name')

  if (opts?.activeOnly !== false) {
    query = query.eq('active', true)
  }

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return ((data ?? []) as RoomRow[]).map(mapRowToRoom)
}

export async function addRoom(
  supabase: SupabaseClient,
  shopId: string,
  name: string
): Promise<{ room?: Room; error?: string }> {
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Room name is required' }

  const { data, error } = await supabase
    .from('rooms')
    .insert({ shop_id: shopId, name: trimmed, active: true })
    .select('id, shop_id, name, active, created_at')
    .single()

  if (error) return { error: error.message }
  return { room: mapRowToRoom(data as RoomRow) }
}

export async function deleteRoom(
  supabase: SupabaseClient,
  shopId: string,
  roomId: string
): Promise<{ ok: boolean; error?: string }> {
  const { error } = await supabase
    .from('rooms')
    .delete()
    .eq('id', roomId)
    .eq('shop_id', shopId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
