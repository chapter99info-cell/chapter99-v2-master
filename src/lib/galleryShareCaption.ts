/** Social share caption — one block per photo for FB/IG */

export interface GalleryPhotoShareInput {
  en: string
  th: string
  dest: string
  loc: string
}

export interface TripShareBranding {
  season: string
  year: number
  durationDays: number
}

/** Default trip branding (NZ-AUT-2026 · Jun 2026 · 14 days) */
export const DEFAULT_TRIP_SHARE: TripShareBranding = {
  season: 'Winter',
  year: 2026,
  durationDays: 14,
}

/**
 * [LOCATION_NAME] ✦ [COUNTRY]
 * [HOOK_LINE]
 * 📸 Trip2Talk [SEASON] [YEAR] · [DURATION] Days
 */
export function buildGalleryShareCaption(
  photo: GalleryPhotoShareInput,
  countryLabel: string,
  branding: TripShareBranding = DEFAULT_TRIP_SHARE,
): string {
  const locationName = photo.loc.split(' · ')[0]?.trim() || photo.en
  const hookLine = photo.th.trim() || photo.en
  return [
    `${locationName} ✦ ${countryLabel}`,
    hookLine,
    `📸 Trip2Talk ${branding.season} ${branding.year} · ${branding.durationDays} Days`,
  ].join('\n')
}
