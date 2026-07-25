/**
 * @deprecated Legacy TV playlist service against `tv_playlist_items`.
 * Digital Signage uses get_signage_data / admin_* RPCs (signage_assets).
 * Left as a no-op stub so accidental imports fail clearly at call sites.
 *
 * TODO: AI banner generation can later upload to Storage + admin_upsert_signage_asset
 * without restoring this module.
 */

export type TvPlaylistType = 'video' | 'photo' | 'banner' | 'menu_slide'

export interface TvPlaylistItem {
  id: string
  shop_id: string
  type: TvPlaylistType
  media_url: string | null
  title: string | null
  duration_seconds: number
  sort_order: number
  active: boolean
  created_at: string
}

function retired(): never {
  throw new Error(
    '[deprecated] tvSignageService / tv_playlist_items retired — use /signage/:shopId and signageAdminService'
  )
}

export async function fetchActiveTvPlaylist(_shopId: string): Promise<TvPlaylistItem[]> {
  return retired()
}
export async function fetchAllTvPlaylist(_shopId: string): Promise<TvPlaylistItem[]> {
  return retired()
}
export async function insertTvPlaylistItem(_input: unknown): Promise<TvPlaylistItem> {
  return retired()
}
export async function updateTvPlaylistItem(_id: string, _patch: unknown): Promise<void> {
  return retired()
}
export async function deleteTvPlaylistItem(_id: string): Promise<void> {
  return retired()
}
export async function reorderTvPlaylist(_orderedIds: string[]): Promise<void> {
  return retired()
}
export async function uploadTvSignageMedia(
  _shopId: string,
  _file: File
): Promise<{ url: string }> {
  return retired()
}
export async function uploadTvBannerPng(_shopId: string, _blob: Blob): Promise<string> {
  return retired()
}
export async function renderBannerPng(_opts: {
  imageUrl: string
  headline: string
  priceText?: string
}): Promise<Blob> {
  return retired()
}

/** @deprecated Prefer `/signage/${shopId}` */
export function buildTvKioskUrl(slug: string, origin?: string): string {
  const key = slug.trim().toLowerCase()
  const base =
    origin ||
    (typeof window !== 'undefined'
      ? window.location.origin
      : 'https://chapter99thaimass-v20.vercel.app')
  return `${base.replace(/\/$/, '')}/tv-kiosk?shop=${encodeURIComponent(key)}`
}
