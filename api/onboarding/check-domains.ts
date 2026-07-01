import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSuperAdminSession } from '../server/adminAuth'
import { checkDomains } from '../server/onboardingHandlers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!requireSuperAdminSession(req, res)) return
  const { domains } = req.body as { domains?: string[] }
  const result = await checkDomains(domains ?? [])
  return res.json(result)
}
