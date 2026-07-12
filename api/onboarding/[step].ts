import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireSuperAdminSession } from '../../server/adminAuth'
import { onboardingHandlers } from '../../server/onboardingHandlers'

const STEPS: Record<string, (body: unknown) => Promise<unknown>> = {
  'check-domains': async body => {
    const { domains } = body as { domains?: string[] }
    return onboardingHandlers.checkDomains(domains ?? [])
  },
  'register-shop': async body =>
    onboardingHandlers.registerShopInRegistry(
      body as Parameters<typeof onboardingHandlers.registerShopInRegistry>[0]
    ),
  'create-shop-db': async body =>
    onboardingHandlers.createShopInDb(
      body as Parameters<typeof onboardingHandlers.createShopInDb>[0]
    ),
  deploy: async () => onboardingHandlers.triggerDeploy(),
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!requireSuperAdminSession(req, res)) return

  const raw = req.query.step
  const step = (Array.isArray(raw) ? raw[0] : raw) ?? ''
  const run = STEPS[step]
  if (!run) return res.status(404).json({ error: `Unknown onboarding step: ${step}` })

  try {
    const result = await run(req.body ?? {})
    return res.status(200).json({ ok: true, step, result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Onboarding step failed'
    return res.status(500).json({ ok: false, step, error: message })
  }
}
