import type { VercelRequest, VercelResponse } from '@vercel/node'
import { isPlatformHost, normalizeHostname } from '../lib/shopDomainMap'
import { alertUnmappedShopDomain } from '../lib/shopDomainAlert'
import { parseJsonBody, sendJsonError } from '../server/apiUtils'
import { withJsonApi } from '../server/jsonApi'

interface AlertBody {
  host?: string
  source?: string
  path?: string
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return sendJsonError(res, 405, 'Method not allowed')
  }

  const body = parseJsonBody<AlertBody>(req)
  const host = normalizeHostname(body.host ?? String(req.headers['x-forwarded-host'] ?? req.headers.host ?? ''))
  const source = body.source?.trim() || 'client'

  if (!host || isPlatformHost(host)) {
    return res.status(200).json({ ok: true, skipped: true })
  }

  await alertUnmappedShopDomain({
    host,
    source,
    path: body.path,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  })

  return res.status(200).json({ ok: true })
}

export default withJsonApi(handler)
