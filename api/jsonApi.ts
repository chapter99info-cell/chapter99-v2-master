import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendJsonError } from './apiUtils'

export type ApiHandler = (
  req: VercelRequest,
  res: VercelResponse
) => void | Promise<void | VercelResponse>

/** Ensures every response is JSON — avoids SPA/HTML "Unexpected token" on the client. */
export function withJsonApi(handler: ApiHandler): ApiHandler {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    try {
      await handler(req, res)
    } catch (err) {
      console.error('[api]', err)
      if (!res.writableEnded) {
        sendJsonError(
          res,
          500,
          err instanceof Error ? err.message : 'Internal server error'
        )
      }
    }
  }
}
