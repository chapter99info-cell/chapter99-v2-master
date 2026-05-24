import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  createStripeClient,
  getRequestOrigin,
  getStripeSecret,
  parseJsonBody,
  sendJsonError,
  stripeErrorMessage,
} from '../server/apiUtils'
import { completeBookingDepositSession } from '../server/bookingDepositCore'
import { withJsonApi } from '../server/jsonApi'

const ROUTE = 'booking-deposit-complete'

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJsonError(res, 405, 'Method not allowed')
  }

  const secret = getStripeSecret(ROUTE)
  if (!secret) {
    return sendJsonError(res, 500, 'STRIPE_SECRET_KEY is not configured on the server')
  }

  const { sessionId } = parseJsonBody<{ sessionId?: string }>(req)
  if (!sessionId?.trim()) {
    return sendJsonError(res, 400, 'sessionId required')
  }

  const stripe = createStripeClient(secret)
  const session = await stripe.checkout.sessions.retrieve(sessionId.trim())
  const origin = getRequestOrigin(req)

  const result = await completeBookingDepositSession(session, origin)

  return res.status(200).json({
    success: true,
    ...result,
  })
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
