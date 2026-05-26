import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isGoldCoastTour } from '../lib/tripFilters'
import { TRIP2TALK_PIXIESET_URL } from '../lib/trip2talkLinks'
import {
  fetchPublishedReviews,
  fetchReviewAggregate,
  fetchGallery,
  toggleGalleryLike,
  subscribeToGalleryLikes,
} from '../lib/missingTablesQueries'
import { getStoredClientId } from '../hooks/useClientSession'
import { T2Button, T2Card, SkeletonCard } from '../components/trip2talk/Trip2TalkShell'
import type { GalleryRow, ReviewAggregate, ReviewWithClient } from '../types/missing_tables'

function TrustBadges() {
  const badges = [
    { icon: '✓', label: 'Licensed operator', sub: 'ABN registered AU tours' },
    { icon: '🛡', label: 'OSHC aware', sub: 'Student health cover tips' },
    { icon: '⭐', label: 'Verified reviews', sub: 'Real trip alumni only' },
    { icon: '📸', label: 'Live gallery', sub: 'Photos from recent groups' },
  ]
  return (
    <div className="grid grid-cols-2 gap-2">
      {badges.map((b) => (
        <div
          key={b.label}
          className="rounded-xl border border-[#2a2520] bg-[#141414] px-3 py-2.5"
        >
          <span className="text-lg text-[#C9A84C]" aria-hidden>
            {b.icon}
          </span>
          <p className="mt-1 text-xs font-semibold text-neutral-100">{b.label}</p>
          <p className="text-[10px] leading-tight text-neutral-500">{b.sub}</p>
        </div>
      ))}
    </div>
  )
}

function StarRow({ rating }: { rating: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= rating ? 'text-amber-400' : 'text-neutral-700'}>
          ★
        </span>
      ))}
    </span>
  )
}

function RatingBars({ aggregate }: { aggregate: ReviewAggregate }) {
  const total = aggregate.total_count || 1
  const stars: (1 | 2 | 3 | 4 | 5)[] = [5, 4, 3, 2, 1]
  return (
    <div className="space-y-1.5">
      {stars.map((star) => {
        const count = aggregate.breakdown[star]
        const pct = Math.round((count / total) * 100)
        return (
          <div key={star} className="flex items-center gap-2 text-xs">
            <span className="w-3 text-neutral-400">{star}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-800">
              <div
                className="h-full rounded-full bg-[#C9A84C] transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-8 text-right text-neutral-500">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function SocialProofPage() {
  const [livePax, setLivePax] = useState<number | null>(null)
  const [paxLoading, setPaxLoading] = useState(true)
  const [reviews, setReviews] = useState<ReviewWithClient[]>([])
  const [aggregate, setAggregate] = useState<ReviewAggregate | null>(null)
  const [reviewsLoading, setReviewsLoading] = useState(true)
  const [gallery, setGallery] = useState<GalleryRow[]>([])
  const [galleryLoading, setGalleryLoading] = useState(true)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [likingId, setLikingId] = useState<string | null>(null)
  const [reviewIndex, setReviewIndex] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  const clientId = getStoredClientId()

  const loadLivePax = useCallback(async () => {
    const { data, error } = await supabase
      .from('tours')
      .select('current_pax, trip_code, destination')
      .eq('status', 'CONFIRMED')

    if (error) {
      console.error('[SocialProof] live PAX:', error.message)
      setLivePax(0)
    } else {
      const total = (data ?? [])
        .filter(
          (row) =>
            !isGoldCoastTour({
              trip_code: String(row.trip_code ?? ''),
              destination: String(row.destination ?? ''),
            })
        )
        .reduce((sum, row) => sum + Number(row.current_pax ?? 0), 0)
      setLivePax(total)
    }
    setPaxLoading(false)
  }, [])

  const loadReviews = useCallback(async () => {
    setReviewsLoading(true)
    try {
      const [list, agg] = await Promise.all([
        fetchPublishedReviews({ limit: 10 }),
        fetchReviewAggregate(),
      ])
      setReviews(list)
      setAggregate(agg)
    } catch (e) {
      console.error('[SocialProof] reviews:', e)
      setReviews([])
      setAggregate({ average_rating: 0, total_count: 0, breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } })
    } finally {
      setReviewsLoading(false)
    }
  }, [])

  const loadGallery = useCallback(async () => {
    setGalleryLoading(true)
    try {
      const rows = await fetchGallery({ limit: 12 })
      setGallery(rows)
    } catch (e) {
      console.error('[SocialProof] gallery:', e)
      setGallery([])
    } finally {
      setGalleryLoading(false)
    }
  }, [])

  const loadMyLikes = useCallback(async () => {
    if (!clientId) {
      setLikedIds(new Set())
      return
    }
    const { data, error } = await supabase
      .from('gallery_likes')
      .select('gallery_id')
      .eq('client_id', clientId)

    if (error) {
      console.error('[SocialProof] likes:', error.message)
      return
    }
    setLikedIds(new Set((data ?? []).map((r) => r.gallery_id as string)))
  }, [clientId])

  useEffect(() => {
    void loadLivePax()
    const channel = supabase
      .channel('pax_live')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tour_bookings' },
        () => {
          void loadLivePax()
        }
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [loadLivePax])

  useEffect(() => {
    void loadReviews()
  }, [loadReviews])

  useEffect(() => {
    void loadGallery()
    void loadMyLikes()
    const unsub = subscribeToGalleryLikes(() => {
      void loadGallery()
      void loadMyLikes()
    })
    return unsub
  }, [loadGallery, loadMyLikes])

  const handleLike = async (item: GalleryRow) => {
    if (!clientId) return
    setLikingId(item.id)
    try {
      const result = await toggleGalleryLike(item.id, clientId)
      setGallery((prev) =>
        prev.map((g) => (g.id === item.id ? { ...g, like_count: result.like_count } : g))
      )
      setLikedIds((prev) => {
        const next = new Set(prev)
        if (result.liked) next.add(item.id)
        else next.delete(item.id)
        return next
      })
    } catch (e) {
      console.error('[SocialProof] toggle like:', e)
    } finally {
      setLikingId(null)
    }
  }

  const onReviewScroll = () => {
    const el = scrollRef.current
    if (!el || !reviews.length) return
    const cardWidth = el.offsetWidth
    const idx = Math.round(el.scrollLeft / cardWidth)
    setReviewIndex(Math.min(idx, reviews.length - 1))
  }

  const scrollToReview = (idx: number) => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ left: idx * el.offsetWidth, behavior: 'smooth' })
    setReviewIndex(idx)
  }

  return (
    <div className="space-y-5 px-4 pb-6 pt-4">
      <header>
        <p className="text-xs font-medium uppercase tracking-wider text-amber-400/90">
          Trip2Talk
        </p>
        <h1 className="text-xl font-bold text-neutral-50">Community proof</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Live bookings, alumni reviews, and trip moments.
        </p>
      </header>

      <T2Card className="border-amber-500/20 bg-gradient-to-br from-neutral-900 to-neutral-950">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-neutral-400">Travellers on confirmed trips</p>
            {paxLoading ? (
              <div className="mt-2 h-9 w-24 animate-pulse rounded-lg bg-neutral-800" />
            ) : (
              <p className="mt-1 flex items-baseline gap-2">
                <span className="animate-pulse text-3xl font-bold tabular-nums text-amber-400">
                  {livePax ?? 0}
                </span>
                <span className="text-sm text-neutral-400">PAX live</span>
              </p>
            )}
          </div>
          <span
            className="relative flex h-3 w-3 shrink-0"
            aria-label="Live counter"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-500" />
          </span>
        </div>
      </T2Card>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-neutral-200">Why trust us</h2>
        <TrustBadges />
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-semibold text-neutral-200">Student reviews</h2>
            {aggregate && aggregate.total_count > 0 && (
              <p className="mt-0.5 text-xs text-neutral-500">
                {aggregate.average_rating.toFixed(1)} avg · {aggregate.total_count} reviews
              </p>
            )}
          </div>
          {aggregate && aggregate.total_count > 0 && (
            <StarRow rating={Math.round(aggregate.average_rating)} />
          )}
        </div>

        {reviewsLoading ? (
          <div className="space-y-2">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : (
          <>
            {aggregate && aggregate.total_count > 0 && (
              <T2Card className="mb-3 py-3">
                <RatingBars aggregate={aggregate} />
              </T2Card>
            )}

            {reviews.length === 0 ? (
              <p className="text-sm text-neutral-500">Reviews coming soon.</p>
            ) : (
              <>
                <div
                  ref={scrollRef}
                  onScroll={onReviewScroll}
                  className="-mx-4 flex snap-x snap-mandatory gap-0 overflow-x-auto scroll-smooth px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                  {reviews.map((r) => (
                    <article
                      key={r.id}
                      className="w-full shrink-0 snap-center px-0.5"
                      style={{ minWidth: '100%' }}
                    >
                      <T2Card className="min-h-[140px]">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-medium text-neutral-100">
                              {r.full_name_en || r.full_name_th}
                            </p>
                            {r.university && (
                              <p className="text-xs text-neutral-500">{r.university}</p>
                            )}
                          </div>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                              r.client_tier === 'VVIP'
                                ? 'bg-amber-500/20 text-amber-400'
                                : r.client_tier === 'VIP'
                                  ? 'bg-amber-500/10 text-amber-300'
                                  : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {r.client_tier}
                          </span>
                        </div>
                        <div className="mt-2">
                          <StarRow rating={r.rating} />
                        </div>
                        {r.title_en && (
                          <p className="mt-2 text-sm font-medium text-neutral-200">
                            {r.title_en}
                          </p>
                        )}
                        <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                          {r.body_en}
                        </p>
                        {r.body_th && (
                          <p className="mt-2 text-xs leading-relaxed text-neutral-500">
                            {r.body_th}
                          </p>
                        )}
                      </T2Card>
                    </article>
                  ))}
                </div>
                <div className="mt-3 flex justify-center gap-1.5">
                  {reviews.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      aria-label={`Review ${i + 1}`}
                      onClick={() => scrollToReview(i)}
                      className={`h-2 rounded-full transition-all ${
                        i === reviewIndex
                          ? 'w-6 bg-amber-400'
                          : 'w-2 bg-neutral-700 hover:bg-neutral-600'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-neutral-200">Trip gallery</h2>
        {galleryLoading ? (
          <div className="columns-2 gap-2 space-y-2">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : gallery.length === 0 ? (
          <p className="text-sm text-neutral-500">No photos yet — check back after the next trip.</p>
        ) : (
          <div className="columns-2 gap-2">
            {gallery.map((item) => {
              const liked = likedIds.has(item.id)
              return (
                <figure
                  key={item.id}
                  className="mb-2 break-inside-avoid overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900"
                >
                  <div className="relative">
                    <img
                      src={item.public_url}
                      alt={item.caption_en ?? 'Trip photo'}
                      className="w-full object-cover"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      disabled={!clientId || likingId === item.id}
                      onClick={() => void handleLike(item)}
                      className={`absolute bottom-2 right-2 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium backdrop-blur transition ${
                        liked
                          ? 'bg-amber-500/90 text-neutral-950'
                          : 'bg-neutral-950/70 text-neutral-100 hover:bg-neutral-900/90'
                      } disabled:opacity-50`}
                      aria-pressed={liked}
                    >
                      {liked ? '♥' : '♡'} {item.like_count}
                    </button>
                  </div>
                  {(item.caption_en || item.caption_th) && (
                    <figcaption className="px-2 py-1.5 text-[11px] text-neutral-400">
                      {item.caption_en}
                      {item.caption_th && (
                        <span className="block text-neutral-600">{item.caption_th}</span>
                      )}
                    </figcaption>
                  )}
                </figure>
              )
            })}
          </div>
        )}
        {!clientId && gallery.length > 0 && (
          <p className="mt-2 text-center text-xs text-neutral-500">
            Sign in to your trip profile to like photos.
          </p>
        )}
      </section>

      <div className="rounded-2xl border border-[#2a2520] bg-gradient-to-br from-[#1a1410] to-[#141414] p-4">
        <p className="font-display text-sm font-semibold text-[#E8C96A]">Ready for your chapter?</p>
        <p className="mt-1 text-xs text-[#8A8070]">
          Join students already booked on confirmed departures.
        </p>
        <a
          href={TRIP2TALK_PIXIESET_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block"
        >
          <T2Button>Explore upcoming trips</T2Button>
        </a>
      </div>
    </div>
  )
}
