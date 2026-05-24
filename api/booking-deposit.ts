import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createStripeClient,
  getRequestOrigin,
  getStripeSecret,
  parseJsonBody,
  sendJsonError,
  stripeErrorMessage,
} from '../server/apiUtils'
import { createBookingDepositCheckout } from '../server/bookingDepositCore'
import { withJsonApi } from '../server/jsonApi'

const ROUTE = 'booking-deposit'

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJsonError(res, 405, 'Method not allowed')
  }

  const secret = getStripeSecret(ROUTE)
  if (!secret) {
    return sendJsonError(res, 500, 'STRIPE_SECRET_KEY is not configured on the server')
  }

  const body = parseJsonBody<{
    bookingId?: string
    shopId?: string
    shopSlug?: string
    clientEmail?: string
  }>(req)

  const bookingId = body.bookingId?.trim()
  const shopId = body.shopId?.trim()
  const shopSlug = body.shopSlug?.trim().toLowerCase()
  const clientEmail = body.clientEmail?.trim()

  if (!bookingId || !shopId || !shopSlug || !clientEmail) {
    return sendJsonError(res, 400, 'bookingId, shopId, shopSlug, and clientEmail are required')
  }

  const stripe = createStripeClient(secret)
  const origin = getRequestOrigin(req)

  const result = await createBookingDepositCheckout({
    stripe,
    bookingId,
    shopId,
    shopSlug,
    origin,
    clientEmail,
  })

  return res.status(200).json(result)
}

export default withJsonApi(async (req, res) => {
  try {
    await handler(req, res)
  } catch (err) {
    console.error(`[${ROUTE}]`, err)
    if (!res.writableEnded) {
      sendJsonError(res, 500, stripeErrorMessage(err), String(err))
    }
  }
})
