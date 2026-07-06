/**
 * Verify shops.feature_overrides column exists and is readable.
 * Usage: node --env-file=.env.local scripts/verify-shop-feature-overrides.mjs
 * Or: VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... node scripts/verify-shop-feature-overrides.mjs
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, key)

const { data, error } = await supabase
  .from('shops')
  .select('id, name, feature_overrides')
  .limit(3)

if (error) {
  console.error('Query failed:', error.message)
  if (error.message.includes('feature_overrides')) {
    console.error('\nColumn missing — run supabase/48-shop-feature-overrides.sql in Supabase SQL Editor first.')
  }
  process.exit(1)
}

console.log('OK — feature_overrides column readable:')
for (const row of data ?? []) {
  console.log(`  ${row.id} (${row.name}):`, JSON.stringify(row.feature_overrides ?? {}))
}
