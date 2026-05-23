import type { VercelRequest, VercelResponse } from '@vercel/node'
import twilio from 'twilio'

const client = twilio(
  process.env.TWILIO_ACCOUNT_SID!,
  process.env.TWILIO_AUTH_TOKEN!
)

/** POST /api/sms — { to, message } */
export async function POST_sms(req: VercelRequest, res: VercelResponse) {
  const { to, message } = req.body
  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' })
  }
  try {
    const msg = await client.messages.create({
      body: message,
      from: process.env.TWILIO_FROM_NUMBER!,
      to: to.startsWith('+') ? to : `+61${to.replace(/^0/, '')}`,
    })
    return res.json({ success: true, sid: msg.sid })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'SMS failed'
    return res.status(500).json({ error: message })
  }
}
