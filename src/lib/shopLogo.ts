// Chapter99 — load shop logo for receipts (jsPDF, react-pdf, print HTML)

import { supabase } from './supabase'

const SHOP_ASSETS_BUCKET = 'shop-assets'

/** Parse object path from a Supabase Storage public (or signed) URL. */
export function storagePathFromPublicUrl(url: string): string | null {
  const markers = [
    `/storage/v1/object/public/${SHOP_ASSETS_BUCKET}/`,
    `/storage/v1/object/sign/${SHOP_ASSETS_BUCKET}/`,
  ]
  for (const marker of markers) {
    const idx = url.indexOf(marker)
    if (idx !== -1) {
      const raw = url.slice(idx + marker.length).split('?')[0]
      return decodeURIComponent(raw)
    }
  }
  return null
}

/** Fetch logo and return PNG data URL (WebP/SVG from Storage → canvas PNG for PDF). */
export async function loadShopLogoDataUrl(url: string): Promise<string | null> {
  const trimmed = url?.trim()
  if (!trimmed) return null

  const storagePath = storagePathFromPublicUrl(trimmed)
  if (storagePath) {
    try {
      const { data, error } = await supabase.storage
        .from(SHOP_ASSETS_BUCKET)
        .download(storagePath)
      if (!error && data) {
        const png = await blobToPngDataUrl(data)
        if (png) return png
      }
    } catch {
      /* fall through to fetch */
    }
  }

  try {
    const res = await fetch(trimmed, { mode: 'cors', cache: 'no-cache' })
    if (!res.ok) return null
    return await blobToPngDataUrl(await res.blob())
  } catch {
    return null
  }
}

function blobToPngDataUrl(blob: Blob): Promise<string | null> {
  return new Promise(resolve => {
    const objectUrl = URL.createObjectURL(blob)
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const maxEdge = 160
        const w0 = img.naturalWidth || 200
        const h0 = img.naturalHeight || 200
        const scale = Math.min(1, maxEdge / Math.max(w0, h0))
        const w = Math.max(1, Math.round(w0 * scale))
        const h = Math.max(1, Math.round(h0 * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        // JPEG keeps email/PDF payloads small vs full-resolution PNG logos
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        resolve(null)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(null)
    }

    img.src = objectUrl
  })
}

export const SHOP_UPDATED_EVENT = 'chapter99-shop-updated'

export function notifyShopUpdated(): void {
  window.dispatchEvent(new CustomEvent(SHOP_UPDATED_EVENT))
}
