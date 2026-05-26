import type { ClientTier, TourDestination, VisaStatus } from './tour'

export type GuideTabType = 'content' | 'photo' | 'location' | 'food'
export type PackingCategory = 'clothing' | 'toiletries' | 'documents' | 'electronics' | 'health' | 'other'
export type PackingPriority = 'must_have' | 'nice_to_have'
export type Season = 'summer' | 'autumn' | 'winter' | 'spring'
export type MapPinCategory = 'hotel' | 'attraction' | 'transport' | 'food' | 'emergency' | 'other'
export type ItineraryBlockType = 'travel' | 'activity' | 'meal' | 'free' | 'checkin'

export interface WaiverRow {
  id: string
  client_id: string
  agreed_terms: boolean
  agreed_risk: boolean
  agreed_medical: boolean
  agreed_media: boolean
  agreed_privacy: boolean
  digital_signature: string
  signed_at: string
  created_at?: string
}

export interface ClientGuideContentRow {
  id: string
  dest: TourDestination | string
  tab_type: GuideTabType
  title_th: string
  title_en: string
  payload: Record<string, unknown>
  sort_order: number
  active?: boolean
}

export interface ReviewRow {
  id: string
  client_id: string
  tour_id: string | null
  rating: number
  title_en: string | null
  title_th: string | null
  body_en: string
  body_th: string
  is_published: boolean
  created_at: string
}

export interface ReviewWithClient extends ReviewRow {
  full_name_th: string
  full_name_en: string
  client_tier: ClientTier
  university: string | null
}

export interface ReviewAggregate {
  average_rating: number
  total_count: number
  breakdown: Record<1 | 2 | 3 | 4 | 5, number>
}

export interface TripGalleryRow {
  id: string
  storage_path: string
  caption_th: string
  caption_en: string
  dest: string
  sort_order: number
  camera_metadata: Record<string, unknown>
  created_at?: string
}

export interface TripGalleryPhoto extends TripGalleryRow {
  public_url: string
}

export interface GalleryRow {
  id: string
  tour_id: string | null
  dest: TourDestination | string
  public_url: string
  caption_en: string | null
  caption_th: string | null
  like_count: number
  created_at: string
}

export interface GalleryLikeRow {
  id: string
  gallery_id: string
  client_id: string
  created_at: string
}

export interface PackingItemRow {
  id: string
  dest: TourDestination | string
  season: Season
  category: PackingCategory
  priority: PackingPriority
  label_th: string
  label_en: string
  weather_note_th: string | null
  weather_note_en: string | null
  sort_order: number
}

export interface ItineraryDayRow {
  id: string
  tour_id: string
  day_number: number
  title_en: string
  title_th: string
  summary_en: string | null
  summary_th: string | null
}

export interface ItineraryBlockRow {
  id: string
  day_id: string
  start_time: string
  end_time: string | null
  block_type: ItineraryBlockType
  title_en: string
  title_th: string
  location_name: string | null
  notes_en: string | null
  notes_th: string | null
  sort_order: number
}

export interface ItineraryBundle {
  days: ItineraryDayRow[]
  blocks: ItineraryBlockRow[]
}

export interface OfflineMapPinRow {
  id: string
  dest: TourDestination | string
  category: MapPinCategory
  name_en: string
  name_th: string
  address: string
  lat: number | null
  lng: number | null
  notes_en: string | null
  notes_th: string | null
  sort_order: number
}

export interface EmergencyContactRow {
  id: string
  dest: TourDestination | string
  label_en: string
  label_th: string
  phone: string
  priority: number
  is_oshc_tip: boolean
}

export interface WeatherSnapshot {
  city: string
  temp_c: number
  feels_like_c: number
  humidity: number
  wind_kph: number
  condition_en: string
  condition_th: string
  icon: string
  fetched_at: string
}

export interface OnboardingFormState {
  first_name_th: string
  last_name_th: string
  first_name_en: string
  last_name_en: string
  passport_number: string
  visa_status: VisaStatus
  oshc_provider: string
  oshc_policy_number: string
  oshc_expiry: string
  medical_conditions: string
  dietary_requirements: string
  phone: string
  email: string
  facebook_profile_url: string
  signature: string
  agreed_terms: boolean
  agreed_risk: boolean
  agreed_medical: boolean
  agreed_media: boolean
  agreed_privacy: boolean
}
