#!/usr/bin/env node
/**
 * Pre-deploy gate — production shop domain mapping must be complete and valid.
 *
 * Checks:
 *  1. shops.config.json structure (shopId + shopSlug per shop, no duplicate domains)
 *  2. Merged map (config + SHOP_DOMAIN_MAP env) — every domain → slug → shopId in registry
 *  3. Every Vercel production custom domain appears in the merged map (no dropped domains)
 *  4. Every referenced shopId exists in Supabase (when credentials are available)
 *
 * Runs on: GitHub Actions (CI), Vercel build (VERCEL=1), or CHECK_SHOP_DOMAINS=1 locally.
 * Exit code 1 blocks deploy.
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = join(ROOT, 'shops.config.json')
const DEFAULT_VERCEL_PROJECT_ID = 'prj_HEo1m0nLxstIv0s1k5QGHcnr0DKz'

const isCI = process.env.GITHUB_ACTIONS === 'true'
const isVercel = process.env.VERCEL === '1'
const forceLocal = process.env.CHECK_SHOP_DOMAINS === '1'

function log(msg) {
  console.log(`[shop-domains] ${msg}`)
}

function fail(errors) {
  console.error('\n❌ Shop domain mapping verification FAILED\n')
  for (const err of errors) {
    console.error(`   • ${err}`)
  }
  console.error('')
  process.exit(1)
}

function normalizeHostname(host) {
  return host.trim().toLowerCase().replace(/^www\./, '')
}

function normalizeDomainKey(domain) {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/.*$/, '')
}

function isPlatformHost(host) {
  const h = normalizeHostname(host)
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true
  if (h.endsWith('.vercel.app')) return true
  return false
}

function loadConfig() {
  const raw = readFileSync(CONFIG_PATH, 'utf8')
  const config = JSON.parse(raw)
  if (!config.shops || typeof config.shops !== 'object') {
    throw new Error('shops.config.json must contain a "shops" object')
  }
  return config
}

function parseEnvDomainMap(raw) {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw)
    const out = {}
    for (const [domain, slug] of Object.entries(parsed)) {
      const host = normalizeDomainKey(domain)
      const key = typeof slug === 'string' ? slug.trim().toLowerCase() : ''
      if (host && key) out[host] = key
    }
    return out
  } catch {
    throw new Error('SHOP_DOMAIN_MAP env is not valid JSON')
  }
}

/** shopSlug → { shopId, name }, shopId → shopSlug, hostname → shopSlug (from config only) */
function buildShopRegistry(config) {
  const bySlug = new Map()
  const byId = new Map()
  const configDomainToSlug = new Map()
  const errors = []

  for (const [key, entry] of Object.entries(config.shops ?? {})) {
    const shopId = entry.shopId?.trim()
    const shopSlug = entry.shopSlug?.trim().toLowerCase()
    const name = entry.name ?? key

    if (!shopId) errors.push(`Shop "${key}" is missing shopId in shops.config.json`)
    if (!shopSlug) errors.push(`Shop "${key}" is missing shopSlug in shops.config.json`)

    if (shopSlug && bySlug.has(shopSlug)) {
      errors.push(`Duplicate shopSlug "${shopSlug}" in shops.config.json`)
    }
    if (shopId && byId.has(shopId)) {
      errors.push(`Duplicate shopId "${shopId}" in shops.config.json`)
    }

    if (shopId && shopSlug) {
      bySlug.set(shopSlug, { shopId, name })
      byId.set(shopId, shopSlug)
    }

    for (const domain of entry.domains ?? []) {
      const host = normalizeDomainKey(domain)
      if (!host) continue
      if (configDomainToSlug.has(host) && configDomainToSlug.get(host) !== shopSlug) {
        errors.push(
          `Domain "${host}" is listed for multiple shops in shops.config.json`
        )
      }
      if (shopSlug) configDomainToSlug.set(host, shopSlug)
    }
  }

  return { bySlug, byId, configDomainToSlug, errors }
}

function buildMergedDomainMap(configDomainToSlug, envMap) {
  const merged = new Map(configDomainToSlug)
  for (const [host, slug] of Object.entries(envMap)) {
    merged.set(host, slug)
  }
  return merged
}

function validateMergedMap(mergedMap, bySlug, envMap, errors) {
  for (const [host, slug] of mergedMap) {
    const shop = bySlug.get(slug)
    if (!shop) {
      const via = envMap[host] ? 'SHOP_DOMAIN_MAP env' : 'shops.config.json'
      errors.push(
        `Domain "${host}" maps to slug "${slug}" (${via}) but no shop with that slug exists in shops.config.json`
      )
      continue
    }
    log(`  ${host} → slug:${slug} → shopId:${shop.shopId} (${shop.name})`)
  }
}

async function fetchVercelProjectDomains(projectId, token) {
  const domains = []
  let until

  do {
    const url = new URL(`https://api.vercel.com/v9/projects/${projectId}/domains`)
    if (until) url.searchParams.set('until', until)

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Vercel domains API ${res.status}: ${body.slice(0, 300)}`)
    }

    const data = await res.json()
    for (const item of data.domains ?? []) {
      if (item?.name) domains.push(item.name)
    }
    until = data.pagination?.next
  } while (until)

  return domains
}

async function fetchSupabaseShops(supabaseUrl, serviceKey) {
  const base = supabaseUrl.replace(/\/$/, '')
  const res = await fetch(`${base}/rest/v1/shops?select=id,slug,name,active`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Supabase shops API ${res.status}: ${body.slice(0, 300)}`)
  }

  return res.json()
}

function validateSupabaseShops(mergedMap, bySlug, supabaseRows, errors) {
  const dbById = new Map()
  const dbBySlug = new Map()

  for (const row of supabaseRows ?? []) {
    if (!row?.id) continue
    dbById.set(row.id, row)
    if (row.slug) dbBySlug.set(String(row.slug).toLowerCase(), row)
  }

  const checkedIds = new Set()

  for (const [, slug] of mergedMap) {
    const expected = bySlug.get(slug)
    if (!expected || checkedIds.has(expected.shopId)) continue
    checkedIds.add(expected.shopId)

    const row = dbById.get(expected.shopId)
    if (!row) {
      errors.push(
        `shopId "${expected.shopId}" (slug "${slug}") is in shops.config.json but NOT found in Supabase shops table`
      )
      continue
    }

    const dbSlug = row.slug ? String(row.slug).toLowerCase() : null
    if (dbSlug && dbSlug !== slug) {
      errors.push(
        `shopId "${expected.shopId}" has slug "${dbSlug}" in Supabase but shops.config.json expects "${slug}"`
      )
    }

    if (row.active === false) {
      errors.push(`shopId "${expected.shopId}" (slug "${slug}") is inactive in Supabase`)
    }
  }

  log(`  Supabase: verified ${checkedIds.size} shopId(s) exist in database`)
}

async function main() {
  if (!isCI && !isVercel && !forceLocal) {
    log('Skipped (local build). Set CHECK_SHOP_DOMAINS=1, push to CI, or build on Vercel.')
    return
  }

  const errors = []
  const envMapRaw =
    process.env.SHOP_DOMAIN_MAP?.trim() ||
    process.env.VITE_SHOP_DOMAIN_MAP?.trim() ||
    ''

  log(`Mode: ${isCI ? 'GitHub Actions' : isVercel ? 'Vercel build' : 'local forced'}`)

  const config = loadConfig()
  const { bySlug, byId, configDomainToSlug, errors: registryErrors } = buildShopRegistry(config)
  errors.push(...registryErrors)

  let envMap = {}
  try {
    envMap = parseEnvDomainMap(envMapRaw)
  } catch (err) {
    errors.push(err.message)
  }

  if (envMapRaw && Object.keys(envMap).length === 0 && registryErrors.length === 0) {
    errors.push('SHOP_DOMAIN_MAP env is set but parsed to an empty map (invalid JSON?)')
  }

  const mergedMap = buildMergedDomainMap(configDomainToSlug, envMap)

  if (mergedMap.size === 0) {
    errors.push('No shop domains configured — shops.config.json domains array is empty')
  }

  log(`Registry: ${bySlug.size} shop(s), ${mergedMap.size} domain(s) in production map`)
  validateMergedMap(mergedMap, bySlug, envMap, errors)

  const needVercel = isCI || isVercel
  const projectId =
    process.env.VERCEL_PROJECT_ID?.trim() || DEFAULT_VERCEL_PROJECT_ID
  const vercelToken =
    process.env.VERCEL_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim()

  if (needVercel && !vercelToken) {
    errors.push(
      'VERCEL_TOKEN is required in CI/Vercel to verify every production domain is mapped (GitHub secret + Vercel env)'
    )
  } else if (vercelToken) {
    log(`Fetching Vercel domains for project ${projectId}…`)
    const vercelDomains = await fetchVercelProjectDomains(projectId, vercelToken)
    const customHosts = [
      ...new Set(vercelDomains.map(normalizeHostname).filter((h) => h && !isPlatformHost(h))),
    ]

    const missingOnMap = customHosts.filter((h) => !mergedMap.has(h))
    if (missingOnMap.length > 0) {
      for (const host of missingOnMap.sort()) {
        errors.push(
          `Vercel production domain "${host}" is NOT in shop domain map — add to shops.config.json`
        )
      }
    } else {
      log(`  Vercel: all ${customHosts.length} custom domain(s) are mapped`)
    }

    const extraOnMap = [...mergedMap.keys()].filter(
      (h) => !isPlatformHost(h) && !customHosts.includes(h) && isCI
    )
    if (extraOnMap.length > 0 && process.env.SHOP_DOMAIN_STRICT_VERCEL === '1') {
      for (const host of extraOnMap.sort()) {
        errors.push(
          `Domain "${host}" is in mapping but not attached to Vercel project (orphan config)`
        )
      }
    }
  }

  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    ''
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''

  if (isCI && (!supabaseUrl || !serviceKey)) {
    errors.push(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY GitHub secrets are required to verify shopIds exist in production database'
    )
  } else if (supabaseUrl && serviceKey) {
    log('Verifying shopIds against Supabase…')
    const rows = await fetchSupabaseShops(supabaseUrl, serviceKey)
    validateSupabaseShops(mergedMap, bySlug, rows, errors)
  } else if (isVercel) {
    log('Supabase credentials not set on Vercel build — skipping DB shopId check (CI enforces this)')
  }

  if (errors.length > 0) {
    fail(errors)
  }

  log('OK — production shop domain mapping is complete and valid')
}

main().catch((err) => {
  fail([err.message || String(err)])
})
