import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useSignagePrices } from '../../hooks/useSignagePrices'
import {
  fetchSignageData,
  type SignageAsset,
  type SignageRotation,
  type SignageShop,
} from '../../lib/signageService'
import {
  attachSignageCacheRefresh,
  syncSignageVideoCache,
} from '../../lib/signageVideoCache'
import './SignagePage.css'

const HEARTBEAT_MS = 60_000
const ASSET_REFRESH_MS = 6 * 60 * 60 * 1000
const DEFAULT_SYNC_MINUTES = 360

type VideoSlot = 'A' | 'B'

export default function SignagePage() {
  const { shopId: rawId } = useParams<{ shopId: string }>()
  const shopId = rawId?.trim() || undefined

  const [shop, setShop] = useState<SignageShop | null>(null)
  const [assets, setAssets] = useState<SignageAsset[]>([])
  const [error, setError] = useState<string | null>(null)
  const [bootDone, setBootDone] = useState(false)
  const [activeSlot, setActiveSlot] = useState<VideoSlot>('A')
  const [srcA, setSrcA] = useState<string | null>(null)
  const [srcB, setSrcB] = useState<string | null>(null)

  const { services } = useSignagePrices(shopId)
  const videoARef = useRef<HTMLVideoElement | null>(null)
  const videoBRef = useRef<HTMLVideoElement | null>(null)
  const urlsRef = useRef<string[]>([])
  const clipIndexRef = useRef(0)
  const syncMinutesRef = useRef(DEFAULT_SYNC_MINUTES)

  const loadBundle = useCallback(async () => {
    if (!shopId) {
      setError('Missing shop id in URL')
      return
    }
    try {
      const data = await fetchSignageData(shopId)
      if (!data.ok || !data.shop) {
        setError(data.error || 'Shop not found')
        setShop(null)
        setAssets([])
        return
      }
      setShop(data.shop)
      setAssets(data.assets)
      setError(null)
      urlsRef.current = data.assets.map((a) => a.videoUrl)
      syncMinutesRef.current =
        data.shop.refreshIntervalMinutes > 0
          ? data.shop.refreshIntervalMinutes
          : DEFAULT_SYNC_MINUTES
      void syncSignageVideoCache(shopId, urlsRef.current)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signage')
    } finally {
      setBootDone(true)
    }
  }, [shopId])

  useEffect(() => {
    void loadBundle()
  }, [loadBundle])

  useEffect(() => {
    if (!shopId) return
    const stop = attachSignageCacheRefresh(
      shopId,
      () => urlsRef.current,
      () => syncMinutesRef.current
    )
    const assetPoll = window.setInterval(() => {
      void loadBundle()
    }, ASSET_REFRESH_MS)
    return () => {
      stop()
      window.clearInterval(assetPoll)
    }
  }, [shopId, loadBundle])

  useEffect(() => {
    if (!shopId) return
    const beat = () => {
      console.log(
        `[signage-health] ${new Date().toISOString()} shopId=${shopId}`
      )
    }
    beat()
    const id = window.setInterval(beat, HEARTBEAT_MS)
    return () => window.clearInterval(id)
  }, [shopId])

  /* Seed dual buffers when clip list changes — never mutate the playing src mid-play. */
  useEffect(() => {
    const clips = assets.filter((a) => a.videoUrl)
    if (clips.length === 0) {
      setSrcA(null)
      setSrcB(null)
      clipIndexRef.current = 0
      return
    }
    clipIndexRef.current = 0
    setActiveSlot('A')
    setSrcA(clips[0].videoUrl)
    setSrcB(clips.length > 1 ? clips[1].videoUrl : clips[0].videoUrl)
  }, [assets])

  const playSlot = useCallback((slot: VideoSlot) => {
    const el = slot === 'A' ? videoARef.current : videoBRef.current
    if (!el) return
    el.currentTime = 0
    const play = el.play()
    if (play && typeof play.catch === 'function') {
      play.catch(() => {
        /* muted autoplay should succeed on Fire Stick */
      })
    }
  }, [])

  useEffect(() => {
    if (!srcA && !srcB) return
    playSlot(activeSlot)
  }, [srcA, srcB, activeSlot, playSlot])

  const onVisibleEnded = useCallback(() => {
    const clips = assets.filter((a) => a.videoUrl)
    if (clips.length === 0) return

    const nextSlot: VideoSlot = activeSlot === 'A' ? 'B' : 'A'
    playSlot(nextSlot)
    setActiveSlot(nextSlot)

    /* After swap, load clip N+2 into the now-hidden element (do not touch visible src). */
    const playingIndex = (clipIndexRef.current + 1) % clips.length
    clipIndexRef.current = playingIndex
    const preloadIndex = (playingIndex + 1) % clips.length
    const preloadUrl = clips[preloadIndex].videoUrl

    if (activeSlot === 'A') {
      /* A was visible → now hidden; load N+2 into A */
      setSrcA(preloadUrl)
    } else {
      setSrcB(preloadUrl)
    }
  }, [activeSlot, assets, playSlot])

  const rotation: SignageRotation = shop?.rotation ?? 0
  const theme = shop?.themeColor || '#0F6E56'
  const hasVideo = Boolean(srcA || srcB)

  if (!bootDone && !error) {
    return (
      <div className="signage-root signage-boot" aria-busy="true">
        <span>Loading…</span>
      </div>
    )
  }

  if (error && !shop) {
    return (
      <div className="signage-root signage-boot">
        <p>{error}</p>
      </div>
    )
  }

  return (
    <div
      className={`signage-root signage-rot-${rotation}`}
      style={{ ['--signage-theme' as string]: theme }}
      data-shop-id={shopId}
    >
      <div className="signage-stage">
        {hasVideo ? (
          <>
            <video
              ref={videoARef}
              className={`signage-video signage-video-slot${
                activeSlot === 'A' ? ' is-active' : ''
              }`}
              src={srcA ?? undefined}
              muted
              playsInline
              preload="auto"
              onEnded={activeSlot === 'A' ? onVisibleEnded : undefined}
              onError={activeSlot === 'A' ? onVisibleEnded : undefined}
            />
            <video
              ref={videoBRef}
              className={`signage-video signage-video-slot${
                activeSlot === 'B' ? ' is-active' : ''
              }`}
              src={srcB ?? undefined}
              muted
              playsInline
              preload="auto"
              onEnded={activeSlot === 'B' ? onVisibleEnded : undefined}
              onError={activeSlot === 'B' ? onVisibleEnded : undefined}
            />
          </>
        ) : (
          <div className="signage-video signage-video-empty" />
        )}

        <aside className="signage-overlay" aria-label="Service prices">
          <header className="signage-overlay-head">
            {shop?.logoUrl ? (
              <img src={shop.logoUrl} alt="" className="signage-logo" />
            ) : null}
            <div>
              <h1>{shop?.name || 'Menu'}</h1>
              <p>Today&apos;s services</p>
            </div>
          </header>
          <ul className="signage-price-list">
            {services.map((svc) => (
              <li key={svc.id}>
                <div className="signage-price-names">
                  <strong>{svc.nameEn}</strong>
                  {svc.nameTh ? <span>{svc.nameTh}</span> : null}
                </div>
                <div className="signage-price-meta">
                  <span className="signage-price-amt">
                    ${Number(svc.price).toFixed(0)}
                  </span>
                  {svc.duration ? (
                    <span className="signage-price-dur">{svc.duration} min</span>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  )
}
