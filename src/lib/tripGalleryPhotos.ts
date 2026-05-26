import { supabase } from './supabase'
import type { TripGalleryPhoto } from '../types/missing_tables'

const BUCKET = 'trip-gallery'
const IMAGE_EXT = /\.(jpe?g|png|webp|heic)$/i

export function galleryFolderForDest(dest: string | null | undefined): string {
  if (dest === 'Sydney') return 'SYD-2025'
  return 'NZ-2025'
}

function publicUrl(storagePath: string): string {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
  return data.publicUrl
}

export async function fetchTripGalleryPhotos(opts?: {
  folder?: string
  dest?: string | null
}): Promise<TripGalleryPhoto[]> {
  const folder = opts?.folder ?? galleryFolderForDest(opts?.dest)
  const dest = opts?.dest ?? 'New Zealand'

  const [{ data: metaRows, error: metaErr }, { data: files, error: listErr }] = await Promise.all([
    supabase.from('trip_gallery').select('*').eq('dest', dest).order('sort_order', { ascending: true }),
    supabase.storage.from(BUCKET).list(folder, { limit: 100, sortBy: { column: 'name', order: 'asc' } }),
  ])

  if (metaErr) throw new Error(metaErr.message)
  if (listErr) throw new Error(listErr.message)

  const metaByPath = new Map(
    (metaRows ?? []).map((row) => [row.storage_path as string, row])
  )

  const imageFiles = (files ?? []).filter(
    (f) => f.name && !f.name.startsWith('.') && IMAGE_EXT.test(f.name)
  )

  const fromStorage: TripGalleryPhoto[] = imageFiles.map((file, index) => {
    const storage_path = `${folder}/${file.name}`
    const meta = metaByPath.get(storage_path)
    return {
      id: meta?.id ?? storage_path,
      storage_path,
      public_url: publicUrl(storage_path),
      caption_th: meta?.caption_th ?? file.name,
      caption_en: meta?.caption_en ?? file.name,
      dest: meta?.dest ?? dest,
      sort_order: meta?.sort_order ?? index + 1,
      camera_metadata: (meta?.camera_metadata as Record<string, unknown>) ?? {},
    }
  })

  if (fromStorage.length > 0) {
    return fromStorage.sort((a, b) => a.sort_order - b.sort_order)
  }

  return (metaRows ?? []).map((row) => ({
    id: row.id as string,
    storage_path: row.storage_path as string,
    public_url: publicUrl(row.storage_path as string),
    caption_th: row.caption_th as string,
    caption_en: row.caption_en as string,
    dest: row.dest as string,
    sort_order: row.sort_order as number,
    camera_metadata: (row.camera_metadata as Record<string, unknown>) ?? {},
  }))
}
