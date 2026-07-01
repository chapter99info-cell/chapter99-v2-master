import type { VercelRequest, VercelResponse } from '@vercel/node'
import { sendShopSms, type SmsPriority } from './smsGateway'

/** POST /api/sms — { to, message, shopId?, priority? } */
export async function POST_sms(req: VercelRequest, res: VercelResponse) {
  const { to, message, shopId, priority } = req.body as {
    to?: string
    message?: string
    shopId?: string
    priority?: SmsPriority
  }

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing to or message' })
  }

  if (!shopId?.trim()) {
    return res.status(400).json({ error: 'shopId required — SMS gated per shop' })
  }

  const result = await sendShopSms({
    shopId: shopId.trim(),
    to,
    message,
    priority: priority ?? 'normal',
  })

  if (result.skipped) {
    return res.json({ success: false, skipped: true, reason: result.reason })
  }

  if (!result.sent) {
    return res.status(500).json({ error: result.reason ?? 'SMS failed' })
  }

  return res.json({ success: true, sid: result.sid })
}
