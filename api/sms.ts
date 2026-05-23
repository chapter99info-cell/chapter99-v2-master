import type { VercelRequest, VercelResponse } from '@vercel/node'
import { POST_sms } from '../server/smsHandler'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'POST') return POST_sms(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
