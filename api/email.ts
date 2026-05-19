import type { VercelRequest, VercelResponse } from '@vercel/node'
import { POST_email } from './posRoutes'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') return POST_email(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
