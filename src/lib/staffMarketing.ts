import type { TripGalleryPhoto } from '../types/missing_tables'

export const MARKETING_STORAGE_KEY = 't2t_staff_marketing_v1'
export const FB_CHAR_LIMIT = 63_206
export const IG_CHAR_LIMIT = 2_200

export type MarketingPlatform = 'facebook' | 'instagram' | 'both'
export type MarketingPostStatus = 'draft' | 'scheduled' | 'posted'
export type CaptionTone = 'professional' | 'casual' | 'fun'

export interface MarketingPhotoRef {
  id: string
  public_url: string
  caption_en: string
}

export interface MarketingPost {
  id: string
  caption: string
  platform: MarketingPlatform
  photoRefs: MarketingPhotoRef[]
  scheduledDate: string | null
  status: MarketingPostStatus
  tone: CaptionTone
  createdAt: string
  updatedAt: string
}

export interface MarketingStore {
  posts: MarketingPost[]
  activeDraftId: string | null
}

const NZ_TAGS = [
  '#NewZealand',
  '#NZTravel',
  '#StudyTourNZ',
  '#Queenstown',
  '#Auckland',
  '#Trip2Talk',
  '#StudentTravel',
]

const AU_TAGS = [
  '#Australia',
  '#Sydney',
  '#StudyTourAU',
  '#Trip2Talk',
  '#StudentTravel',
  '#ExploreAustralia',
]

export function charLimitForPlatform(platform: MarketingPlatform): number {
  if (platform === 'instagram') return IG_CHAR_LIMIT
  if (platform === 'facebook') return FB_CHAR_LIMIT
  return IG_CHAR_LIMIT
}

export function readMarketingStore(): MarketingStore {
  try {
    const raw = localStorage.getItem(MARKETING_STORAGE_KEY)
    if (!raw) return { posts: [], activeDraftId: null }
    const parsed = JSON.parse(raw) as MarketingStore
    return {
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      activeDraftId: parsed.activeDraftId ?? null,
    }
  } catch {
    return { posts: [], activeDraftId: null }
  }
}

export function writeMarketingStore(store: MarketingStore): void {
  localStorage.setItem(MARKETING_STORAGE_KEY, JSON.stringify(store))
}

export function newDraftPost(): MarketingPost {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    caption: '',
    platform: 'both',
    photoRefs: [],
    scheduledDate: null,
    status: 'draft',
    tone: 'casual',
    createdAt: now,
    updatedAt: now,
  }
}

export function hashtagSuggestions(dest: string | null | undefined): string[] {
  const d = (dest ?? '').toLowerCase()
  if (d.includes('zealand') || d === 'new zealand') return NZ_TAGS
  if (d.includes('sydney') || d.includes('australia')) return AU_TAGS
  return [...NZ_TAGS, ...AU_TAGS].slice(0, 8)
}

function toneOpener(tone: CaptionTone): string {
  if (tone === 'professional') return 'Discover an exceptional journey with Trip2Talk.'
  if (tone === 'fun') return 'Best trip vibes only — Trip2Talk style!'
  return 'Another unforgettable day on tour with Trip2Talk.'
}

export function generateCaptionSuggestions(
  photos: MarketingPhotoRef[],
  tone: CaptionTone,
  dest?: string | null
): string[] {
  const labels = photos.map((p) => p.caption_en).filter(Boolean)
  const place = labels[0]?.split(' · ')[0]?.trim() || labels[0] || dest || 'our destination'
  const country =
    (dest ?? '').toLowerCase().includes('zealand')
      ? 'New Zealand'
      : (dest ?? '').toLowerCase().includes('australia') || (dest ?? '').includes('Coast')
        ? 'Australia'
        : 'Australia & New Zealand'

  const opener = toneOpener(tone)
  const tags = hashtagSuggestions(dest).slice(0, 4).join(' ')

  return [
    `${place} ✦ ${country}\n${opener}\n📸 Trip2Talk student tours\n${tags}`,
    `${opener}\n${labels.slice(0, 2).join(' · ') || place}\nBook your spot — link in bio.\n${tags}`,
    `Memories from ${place} 🇳🇿🇦🇺\n${tone === 'fun' ? 'Who else wants to come next year? 🙌' : 'Enquiries welcome for upcoming departures.'}\n${tags}`,
  ]
}

export function photosToRefs(photos: TripGalleryPhoto[]): MarketingPhotoRef[] {
  return photos.map((p) => ({
    id: p.id,
    public_url: p.public_url,
    caption_en: p.caption_en,
  }))
}
