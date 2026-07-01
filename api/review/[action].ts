import type { VercelRequest, VercelResponse } from '@vercel/node'
import reviewSubmitHandler from '../../server/reviewSubmitRoute'
import reviewRequestHandler from '../../server/reviewRequestRoute'

const HANDLERS: Record<string, (req: VercelRequest, res: VercelResponse) => Promise<unknown>> = {
  submit: reviewSubmitHandler,
  request: reviewRequestHandler,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.action
  const action = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  const run = HANDLERS[action]
  if (!run) {
    return res.status(404).json({ error: `Unknown review action: ${action}` })
  }
  return run(req, res)
}
