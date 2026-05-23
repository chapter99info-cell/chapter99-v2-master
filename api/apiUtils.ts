import type { VercelRequest, VercelResponse } from '@vercel/node'
import Stripe from 'stripe'

const DEFAULT_PUBLIC_ORIGIN = 'https://chapter99-v4-complete.vercel.app'

/** Parse POST JSON body (Vercel may pass object or raw string). */
export function parseJsonBody<T extends Record<string, unknown>>(
  req: VercelRequest
): T {
  const raw = req.body
  if (raw == null) return {} as T
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T
    } catch {
      return {} as T
    }
  }
  return raw as T
}

export function getRequestOrigin(req: VercelRequest): string {
  const origin = req.headers.origin
  if (typeof origin === 'string' && origin.startsWith('http')) return origin

  const proto = req.headers['x-forwarded-proto']
  const host = req.headers.host
  const scheme = Array.isArray(proto) ? proto[0] : proto
  if (scheme && host) return `${scheme}://${host}`

  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return DEFAULT_PUBLIC_ORIGIN
}

export function getStripeSecret(route: string): string | null {
  const secret =
    process.env.STRIPE_SECRET_KEY?.trim() ||
    process.env.STRIPE_SECRET?.trim() ||
    ''
  const loaded = Boolean(secret)
  console.log(
    `[${route}] STRIPE_SECRET_KEY loaded:`,
    loaded,
    loaded ? `${secret.slice(0, 7)}… (${secret.length} chars)` : 'missing'
  )
  if (!loaded) return null
  return secret
}

export function createStripeClient(secret: string): Stripe {
  return new Stripe(secret, { apiVersion: '2024-06-20' })
}

export function stripeErrorMessage(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err) {
    return String((err as { message: string }).message)
  }
  return 'Stripe checkout failed'
}

export function sendJsonError(
  res: VercelResponse,
  status: number,
  error: string,
  detail?: string
): void {
  res.status(status).json({
    error,
    ...(detail && process.env.NODE_ENV !== 'production' ? { detail } : {}),
  })
}
