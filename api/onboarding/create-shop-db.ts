import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSuperAdminSession } from '../../server/adminAuth'
import { createShopInDb } from '../../server/onboardingHandlers'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })
  if (!requireSuperAdminSession(req, res)) return
  const result = await createShopInDb(req.body)
  return res.json(result)
}
