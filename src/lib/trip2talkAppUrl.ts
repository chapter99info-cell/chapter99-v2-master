import { TRIP2TALK_ORIGIN, isTrip2TalkProduct } from './productDomain'

/** Canonical Trip2Talk origin for QR codes, onboarding links, and share URLs. */
export function getTrip2TalkAppOrigin(): string {
  const fromEnv = [
    import.meta.env.VITE_APP_URL,
    import.meta.env.VITE_PUBLIC_APP_URL,
    import.meta.env.VITE_TRIP2TALK_URL,
  ]
    .map((v) => v?.trim())
    .find((v) => v && v.startsWith('http'))

  if (fromEnv) return fromEnv.replace(/\/$/, '')

  if (typeof window !== 'undefined' && isTrip2TalkProduct()) {
    return window.location.origin.replace(/\/$/, '')
  }

  return TRIP2TALK_ORIGIN
}

export function buildTrip2TalkOnboardUrl(tripCode: string): string {
  const base = getTrip2TalkAppOrigin()
  return `${base}/onboard?trip=${encodeURIComponent(tripCode)}`
}
