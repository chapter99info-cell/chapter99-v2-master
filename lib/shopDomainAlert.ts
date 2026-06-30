/**
 * Runtime alerts for unmapped custom shop domains (edge + server).
 * Set SHOP_DOMAIN_ALERT_WEBHOOK to a Slack-compatible incoming webhook URL.
 */

export interface ShopDomainAlertPayload {
  host: string
  source: string
  path?: string
  userAgent?: string
}

const recentAlerts = new Map<string, number>()
const DEDUP_MS = 15 * 60 * 1000

function shouldSendAlert(host: string): boolean {
  const now = Date.now()
  const last = recentAlerts.get(host)
  if (last != null && now - last < DEDUP_MS) return false
  recentAlerts.set(host, now)
  return true
}

function buildAlertMessage(payload: ShopDomainAlertPayload): string {
  const lines = [
    '⚠️ Chapter99: unmapped shop custom domain',
    `Host: ${payload.host}`,
    `Source: ${payload.source}`,
  ]
  if (payload.path) lines.push(`Path: ${payload.path}`)
  if (payload.userAgent) lines.push(`UA: ${payload.userAgent.slice(0, 120)}`)
  lines.push(
    '',
    'Add this hostname to shops.config.json (and redeploy), or set SHOP_DOMAIN_MAP override.'
  )
  return lines.join('\n')
}

/** Log + optional webhook (Slack { "text": "..." } compatible). */
export async function alertUnmappedShopDomain(payload: ShopDomainAlertPayload): Promise<void> {
  const host = payload.host.trim().toLowerCase()
  if (!host) return

  console.warn('[shop-domain]', buildAlertMessage(payload))

  if (!shouldSendAlert(host)) return

  const webhook = process.env.SHOP_DOMAIN_ALERT_WEBHOOK?.trim()
  if (!webhook) return

  try {
    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: buildAlertMessage(payload),
        host: payload.host,
        source: payload.source,
        path: payload.path ?? null,
      }),
    })
  } catch (err) {
    console.error('[shop-domain] webhook alert failed:', err)
  }
}
