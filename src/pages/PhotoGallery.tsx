import { useCallback, useEffect, useState } from 'react'
import { useClientSession } from '../hooks/useClientSession'
import { fetchTripGalleryPhotos, galleryFolderForDest } from '../lib/tripGalleryPhotos'
import type { TripGalleryPhoto } from '../types/missing_tables'
import './ClientApp.css'
import './PhotoGallery.css'

type Lang = 'EN' | 'TH'

function metaLine(meta: Record<string, unknown>, key: string): string | undefined {
  const v = meta[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

function CameraMeta({ meta }: { meta: Record<string, unknown> }) {
  const make = metaLine(meta, 'camera_make')
  const model = metaLine(meta, 'camera_model')
  const lens = metaLine(meta, 'lens')
  const focal = metaLine(meta, 'focal_length')
  const aperture = metaLine(meta, 'aperture')
  const shutter = metaLine(meta, 'shutter_speed')
  const iso = metaLine(meta, 'iso')
  const location = metaLine(meta, 'location')
  const taken = metaLine(meta, 'taken_at')

  if (!make && !model) return null

  return (
    <div className="client-neon__panel mt-3 rounded-lg p-3 text-[10px] leading-relaxed text-[#8899aa]">
      <p className="client-neon__glow-cyan text-[#C9A84C]">
        {(make ?? '') + (model ? ` ${model}` : '')}
      </p>
      {lens && <p>LENS :: {lens}</p>}
      <p>
        {[focal, aperture, shutter, iso && `ISO ${iso}`].filter(Boolean).join(' · ')}
      </p>
      {location && <p className="text-[#ffe600]">LOC :: {location}</p>}
      {taken && <p className="client-neon__mono text-[#556677]">{taken}</p>}
    </div>
  )
}

export default function PhotoGallery() {
  const { tour, destination, loading: sessionLoading } = useClientSession()
  const [lang, setLang] = useState<Lang>('EN')
  const [photos, setPhotos] = useState<TripGalleryPhoto[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const dest = tour?.destination ?? destination ?? 'New Zealand'
  const folder = galleryFolderForDest(dest)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTripGalleryPhotos({ folder, dest })
      setPhotos(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load gallery')
      setPhotos([])
    } finally {
      setLoading(false)
    }
  }, [folder, dest])

  useEffect(() => {
    if (sessionLoading) return
    void load()
  }, [sessionLoading, load])

  const active = activeIndex !== null ? photos[activeIndex] : null

  const goPrev = () => {
    if (activeIndex === null || photos.length === 0) return
    setActiveIndex((activeIndex - 1 + photos.length) % photos.length)
  }

  const goNext = () => {
    if (activeIndex === null || photos.length === 0) return
    setActiveIndex((activeIndex + 1) % photos.length)
  }

  const caption = (p: TripGalleryPhoto) => (lang === 'TH' ? p.caption_th : p.caption_en)

  return (
    <div className="photo-gallery-neon client-neon min-h-full pb-4">
      <div className="client-neon__grid" aria-hidden />
      <div className="client-neon__scanlines" aria-hidden />

      <div className="client-neon__inner">
        <header className="client-neon__panel sticky top-0 z-40 mx-3 mt-3 rounded-lg px-4 py-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] uppercase tracking-[0.35em] text-[#8A8070]">
                PHOTO_ARCHIVE
              </p>
              <h1 className="client-neon__glow-cyan mt-2 text-lg font-bold uppercase tracking-wider text-[#C9A84C]">
                TRIP_GALLERY
              </h1>
              <p className="mt-2 text-[10px] text-[#ffe600]">
                BUCKET::{folder} // {dest}
              </p>
            </div>
            <div className="flex shrink-0 rounded border border-[#C9A84C]/30 p-0.5 text-[9px] font-bold">
              {(['EN', 'TH'] as Lang[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setLang(l)}
                  className={`rounded px-2 py-1 transition active:scale-95 ${
                    lang === l ? 'client-neon__tab-active' : 'text-[#556677]'
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </header>

        <main className="px-3 py-4">
          {(sessionLoading || loading) && (
            <div className="columns-2 gap-2 space-y-2">
              <div className="client-neon__skeleton mb-2 h-40 break-inside-avoid rounded-lg" />
              <div className="client-neon__skeleton mb-2 h-52 break-inside-avoid rounded-lg" />
              <div className="client-neon__skeleton mb-2 h-36 break-inside-avoid rounded-lg" />
            </div>
          )}

          {!sessionLoading && !loading && error && (
            <div className="client-neon__panel rounded-lg p-4">
              <p className="text-xs text-[#ff2d95]">ERR::{error}</p>
              <button
                type="button"
                onClick={() => void load()}
                className="client-neon__glow-cyan mt-3 text-xs text-[#C9A84C] transition active:scale-95"
              >
                [ RETRY ]
              </button>
              <p className="mt-3 text-[10px] text-[#8899aa]">
                Upload 5 images to Supabase Storage → trip-gallery / {folder}/
              </p>
            </div>
          )}

          {!sessionLoading && !loading && !error && photos.length === 0 && (
            <div className="client-neon__panel rounded-lg p-6 text-center">
              <p className="text-xs text-[#8899aa]">NO_FILES::{folder}</p>
              <p className="mt-2 text-[10px] text-[#556677]">
                Run 007 + 008 SQL, then upload JPGs to bucket trip-gallery
              </p>
            </div>
          )}

          {!sessionLoading && !loading && !error && photos.length > 0 && (
            <div className="columns-2 gap-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className="client-neon__panel mb-2 w-full break-inside-avoid overflow-hidden rounded-lg text-left transition active:scale-[0.98]"
                >
                  <img
                    src={photo.public_url}
                    alt={caption(photo)}
                    className="w-full object-cover"
                    loading="lazy"
                    style={{ boxShadow: '0 0 16px rgba(0, 245, 255, 0.15)' }}
                  />
                  <div className="border-t border-[#C9A84C]/20 px-2 py-2">
                    <p className="line-clamp-2 text-[10px] text-[#C9A84C]">{caption(photo)}</p>
                    <p className="mt-0.5 font-mono text-[9px] text-[#556677]">
                      {String(index + 1).padStart(2, '0')}/{String(photos.length).padStart(2, '0')}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </main>
      </div>

      {active && activeIndex !== null && (
        <div className="photo-gallery-neon__lightbox" role="dialog" aria-modal="true">
          <div className="photo-gallery-neon__scanlines" aria-hidden />
          <div className="relative z-[102] flex items-center justify-between px-3 py-3">
            <button
              type="button"
              onClick={() => setActiveIndex(null)}
              className="rounded border border-[#ff2d95]/50 px-3 py-1.5 text-xs text-[#ff2d95] transition active:scale-95"
            >
              [ CLOSE ]
            </button>
            <span className="font-mono text-xs text-[#C9A84C]">
              {String(activeIndex + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}
            </span>
          </div>

          <div className="relative z-[102] flex flex-1 flex-col px-3 pb-6">
            <div className="client-neon__panel flex flex-1 flex-col overflow-hidden rounded-lg">
              <img
                src={active.public_url}
                alt={caption(active)}
                className="max-h-[50vh] w-full object-contain"
              />
              <div className="border-t border-[#ff2d95]/30 p-4">
                <p className="text-sm font-bold text-[#E8C96A]">
                  {caption(active)}
                </p>
                <p className="mt-1 text-[10px] text-[#8899aa]">
                  {lang === 'EN' ? active.caption_th : active.caption_en}
                </p>
                <CameraMeta meta={active.camera_metadata} />
              </div>
            </div>

            <div className="mt-4 flex justify-between gap-3">
              <button
                type="button"
                onClick={goPrev}
                className="client-neon__panel flex-1 rounded-lg py-3 text-xs font-bold text-[#C9A84C] transition active:scale-95"
              >
                ◀ PREV
              </button>
              <button
                type="button"
                onClick={goNext}
                className="client-neon__panel flex-1 rounded-lg py-3 text-xs font-bold text-[#C9A84C] transition active:scale-95"
              >
                NEXT ▶
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
