#!/usr/bin/env node
/**
 * Prebuild gate — validates SHOP_REGISTRY and syncs shops.config.json.
 *
 * Checks:
 *  1. No duplicate domains, shopSlugs, or shopIds in src/config/shopRegistry.ts
 *  2. shops.config.json matches registry (auto-written when out of sync)
 *  3. SHOP_DOMAIN_MAP env does not conflict with registry domains
 *  4. Each theme HomePage.tsx imports locked core components
 *
 * Run: npm run validate-shops
 * Runs automatically via npm prebuild before every build.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  SHOP_REGISTRY,
  getShopsConfigFromRegistry,
  validateEnvDomainMap,
  validateShopRegistry,
} from '../src/config/shopRegistry.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_PATH = join(ROOT, 'shops.config.json')

const THEME_IDS = ['elegant', 'traditional', 'minimal', 'modern'] as const
const REQUIRED_CORE_COMPONENTS = ['BookingButton', 'POSLink', 'StaffLoginButton'] as const

function validateThemeCoreComponents(): string[] {
  const issues: string[] = []

  for (const themeId of THEME_IDS) {
    const homePath = join(ROOT, 'src', 'themes', `theme-${themeId}`, 'HomePage.tsx')
    let content: string
    try {
      content = readFileSync(homePath, 'utf8')
    } catch {
      issues.push(`theme-${themeId}/HomePage.tsx not found`)
      continue
    }

    for (const component of REQUIRED_CORE_COMPONENTS) {
      const importPattern = new RegExp(
        `import\\s+${component}\\s+from\\s+['"][^'"]+/${component}['"]`
      )
      if (!importPattern.test(content)) {
        issues.push(
          `theme-${themeId}/HomePage.tsx missing import for ${component}`
        )
      }
    }
  }

  return issues
}

function log(message: string) {
  console.log(`[validate-shops] ${message}`)
}

function fail(issues: string[]) {
  console.error('\n❌ Shop registry validation FAILED\n')
  for (const issue of issues) {
    console.error(`   • ${issue}`)
  }
  console.error('')
  process.exit(1)
}

function stripRegistryOnlyFields(
  shops: Record<string, { name: string; shopId: string; shopSlug: string; domains: string[] }>
) {
  const out: Record<string, { name: string; shopId: string; shopSlug: string; domains: string[] }> =
    {}
  for (const [key, entry] of Object.entries(shops)) {
    out[key] = {
      name: entry.name,
      shopId: entry.shopId,
      shopSlug: entry.shopSlug,
      domains: [...entry.domains],
    }
  }
  return out
}

function buildConfigJson() {
  const config = getShopsConfigFromRegistry()
  return `${JSON.stringify({ shops: stripRegistryOnlyFields(config.shops) }, null, 2)}\n`
}

function loadExistingConfigJson(): string | null {
  try {
    return readFileSync(CONFIG_PATH, 'utf8')
  } catch {
    return null
  }
}

function main() {
  const issues: string[] = []

  for (const issue of validateShopRegistry()) {
    issues.push(issue.message)
  }

  const envMapRaw =
    process.env.SHOP_DOMAIN_MAP?.trim() ||
    process.env.VITE_SHOP_DOMAIN_MAP?.trim() ||
    ''

  for (const issue of validateEnvDomainMap(envMapRaw)) {
    issues.push(issue.message)
  }

  for (const issue of validateThemeCoreComponents()) {
    issues.push(issue)
  }

  const expectedJson = buildConfigJson()
  const existingJson = loadExistingConfigJson()

  if (existingJson !== expectedJson) {
    writeFileSync(CONFIG_PATH, expectedJson, 'utf8')
    log('Updated shops.config.json from SHOP_REGISTRY')
  }

  try {
    const parsed = JSON.parse(expectedJson) as { shops?: Record<string, unknown> }
    for (const key of Object.keys(SHOP_REGISTRY)) {
      if (!parsed.shops?.[key]) {
        issues.push(`shops.config.json is missing registry shop "${key}"`)
      }
    }
  } catch {
    issues.push('Generated shops.config.json is invalid JSON')
  }

  if (issues.length > 0) {
    fail(issues)
  }

  const shopCount = Object.keys(SHOP_REGISTRY).length
  const domainCount = Object.values(SHOP_REGISTRY).reduce(
    (sum, entry) => sum + (entry.domains?.length ?? 0),
    0
  )

  log(`OK — ${shopCount} shop(s), ${domainCount} domain(s), ${THEME_IDS.length} theme(s), no conflicts`)
  for (const [key, entry] of Object.entries(SHOP_REGISTRY)) {
    log(`  ${key}: ${entry.name} (${entry.shopSlug} → ${entry.shopId})`)
  }
}

main()
