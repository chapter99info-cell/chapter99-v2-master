import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getServiceSupabase } from './supabaseServer'
import { normalizeCustomDomain } from '../src/config/shopRegistry'

import {
  generateShopIdFromName,
  generateShopSlug,
  slugify,
  type OnboardingPayload,
} from '../src/lib/onboardingUtils'

export type { OnboardingPayload }

export { generateShopIdFromName, generateShopSlug, slugify }

export async function checkDomains(domains: string[]): Promise<{
  ok: boolean
  conflicts: { domain: string; existingSlug: string }[]
}> {
  const normalized = domains.map(normalizeCustomDomain).filter(Boolean)
  const conflicts: { domain: string; existingSlug: string }[] = []

  let registryMap: Record<string, string> = {}
  try {
    const configPath = join(process.cwd(), 'shops.config.json')
    const raw = readFileSync(configPath, 'utf8')
    const parsed = JSON.parse(raw) as { shops?: Record<string, { shopSlug: string; domains: string[] }> }
    for (const entry of Object.values(parsed.shops ?? {})) {
      for (const d of entry.domains ?? []) {
        const host = normalizeCustomDomain(d)
        if (host) registryMap[host] = entry.shopSlug
      }
    }
  } catch {
    registryMap = {}
  }

  for (const host of normalized) {
    const slug = registryMap[host]
    if (slug) conflicts.push({ domain: host, existingSlug: slug })
  }

  const sb = getServiceSupabase()
  for (const host of normalized) {
    const { data } = await sb.from('shops').select('slug, domain').eq('domain', host).maybeSingle()
    if (data?.slug) {
      conflicts.push({ domain: host, existingSlug: String(data.slug) })
    }
  }

  return { ok: conflicts.length === 0, conflicts }
}

export async function registerShopInRegistry(payload: OnboardingPayload): Promise<{ ok: boolean; error?: string }> {
  const token = process.env.GITHUB_TOKEN?.trim()
  const repo = process.env.GITHUB_REPO?.trim() || 'chapter99info-cell/chapter99-v4-complete'
  const branch = process.env.GITHUB_BRANCH?.trim() || 'main'

  if (!token) {
    return { ok: false, error: 'GITHUB_TOKEN not configured' }
  }

  try {
    const { Octokit } = await import('@octokit/rest')
    const octokit = new Octokit({ auth: token })
    const [owner, repoName] = repo.split('/')

    const registryPath = 'src/config/shopRegistry.ts'
    const { data: fileData } = await octokit.repos.getContent({
      owner,
      repo: repoName,
      path: registryPath,
      ref: branch,
    })

    if (!('content' in fileData) || !fileData.content) {
      return { ok: false, error: 'Could not read shopRegistry.ts from GitHub' }
    }

    const current = Buffer.from(fileData.content, 'base64').toString('utf8')
    // Preserve apex + www literals (like Mira); strip protocol/path only — do NOT
    // strip www or normalizeCustomDomain will collapse both to the same value.
    const seenDomains = new Set<string>()
    const domainLines = payload.domains
      .map(d =>
        d
          .trim()
          .toLowerCase()
          .replace(/^https?:\/\//, '')
          .replace(/\/.*$/, '')
      )
      .filter(host => {
        if (!host || seenDomains.has(host)) return false
        seenDomains.add(host)
        return true
      })
      .map(d => `      '${d}',`)
      .join('\n')

    const entry = `
  ${JSON.stringify(payload.shopSlug)}: {
    name: ${JSON.stringify(payload.name)},
    shopId: ${JSON.stringify(payload.shopId)},
    shopSlug: ${JSON.stringify(payload.shopSlug)},
    domains: [
${domainLines}
    ],
    tier: ${JSON.stringify(payload.plan === 'starter' ? 'starter' : payload.plan === 'business' ? 'business' : 'professional')},
    active: true,
  },`

    const insertAt = current.indexOf('export const SHOP_REGISTRY')
    const braceStart = current.indexOf('{', insertAt)
    const updated =
      current.slice(0, braceStart + 1) + entry + current.slice(braceStart + 1)

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo: repoName,
      path: registryPath,
      message: `feat(onboarding): add shop ${payload.shopSlug}`,
      content: Buffer.from(updated).toString('base64'),
      sha: fileData.sha,
      branch,
    })

    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'GitHub API failed' }
  }
}

export async function createShopInDb(payload: OnboardingPayload): Promise<{ ok: boolean; error?: string }> {
  const sb = getServiceSupabase()
  const planMap = {
    starter: 'starter',
    professional: 'growth',
    business: 'pro',
  } as const

  const primaryDomain = payload.domains.map(normalizeCustomDomain).find(Boolean) ?? null
  // Live schema uses theme (e.g. 'theme-elegant') + theme_color (hex), not theme_id.
  const theme = `theme-${payload.themeId}`
  const themeColor = payload.primaryColor?.trim() || null

  const { error } = await sb.from('shops').insert({
    id: payload.shopId,
    slug: payload.shopSlug,
    name: payload.name,
    abn: payload.abn || null,
    address: payload.address || null,
    email: payload.ownerEmail || null,
    phone: payload.ownerPhone || null,
    notification_email: payload.ownerEmail || null,
    plan: planMap[payload.plan],
    domain: primaryDomain,
    theme,
    theme_color: themeColor,
    sms_enabled: false,
    sms_package: 'none',
    active: true,
    business_type: 'massage',
  })

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

export async function triggerDeploy(): Promise<{ ok: boolean; error?: string }> {
  const hook = process.env.VERCEL_DEPLOY_HOOK_URL?.trim()
  if (!hook) {
    return { ok: false, error: 'VERCEL_DEPLOY_HOOK_URL not configured' }
  }
  try {
    const res = await fetch(hook, { method: 'POST' })
    if (!res.ok) {
      return { ok: false, error: `Deploy hook returned ${res.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Deploy failed' }
  }
}

/** Exported handler functions for api/onboarding routes */
export const onboardingHandlers = {
  checkDomains,
  registerShopInRegistry,
  createShopInDb,
  triggerDeploy,
}
