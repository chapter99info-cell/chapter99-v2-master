/**
 * Apply supabase/41-staff-pin-hash-four-digit-only.sql via Management API.
 * Requires: SUPABASE_ACCESS_TOKEN with access to project euiwkvozrhnbxttfuchh
 * Usage: SUPABASE_ACCESS_TOKEN=sbp_... npx tsx scripts/apply-staff-pin-hash-migration.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const PROJECT_REF = 'euiwkvozrhnbxttfuchh'
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
if (!token) {
  console.error('Set SUPABASE_ACCESS_TOKEN (supabase login / dashboard access token)')
  process.exit(1)
}

const sql = readFileSync(
  resolve('supabase/41-staff-pin-hash-four-digit-only.sql'),
  'utf8'
)

const res = await fetch(
  `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  }
)

const body = await res.text()
if (!res.ok) {
  console.error(`Migration failed (${res.status}):`, body)
  process.exit(1)
}
console.log('Migration applied OK:', body.slice(0, 500))
