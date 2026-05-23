import type { VercelRequest, VercelResponse } from '@vercel/node'
import { POST_email } from '../server/emailHandler'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (req.method === 'POST') return POST_email(req, res)
  return res.status(405).json({ error: 'Method not allowed' })
}
