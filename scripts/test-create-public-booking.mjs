#!/usr/bin/env node
/**
 * Smoke test: create_public_booking RPC end-to-end (Mira shop-001).
 * Requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY in env or .env.local.
 * Creates a test booking, verifies get_public_review_context, then cancels it.
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SHOP_ID = 'shop-001'

function loadEnvFile(name) {
  const path = join(ROOT, name)
  if (!existsSync(path)) return
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[key]) process.env[key] = val
  }
}

loadEnvFile('.env.local')
loadEnvFile('.env')
loadEnvFile('.env.vercel.test')

const url = process.env.VITE_SUPABASE_URL?.trim()
const anon = process.env.VITE_SUPABASE_ANON_KEY?.trim()

if (!url || !anon) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
  process.exit(1)
}

const sb = createClient(url, anon)

function sydneySlotIso(dateYmd, hour, minute) {
  return new Date(`${dateYmd}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+10:00`).toISOString()
}

async function main() {
  console.log('[test-booking] Fetching services…')
  const { data: services, error: svcErr } = await sb.rpc('get_public_services', {
    p_shop_id: SHOP_ID,
  })
  if (svcErr) throw new Error(`get_public_services: ${svcErr.message}`)
  if (!services?.length) throw new Error('No services for shop-001')

  const service = services[0]
  console.log(`[test-booking] Service: ${service.name_en} (${service.id})`)

  const { data: therapists, error: thErr } = await sb.rpc('get_public_therapists', {
    p_shop_id: SHOP_ID,
  })
  if (thErr) throw new Error(`get_public_therapists: ${thErr.message}`)
  const staffId =
    therapists?.find(t => t.role === 'therapist')?.id ??
    therapists?.[0]?.id ??
    null
  const therapistName =
    therapists?.find(t => t.id === staffId)?.name_en ?? null

  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 14)
  const dateYmd = tomorrow.toISOString().slice(0, 10)
  const start = sydneySlotIso(dateYmd, 15, 0)
  const end = new Date(new Date(start).getTime() + Number(service.duration) * 60_000).toISOString()

  console.log(`[test-booking] Slot: ${dateYmd} 15:00 Sydney`)

  const testEmail = `rpc-test+${Date.now()}@chapter99.test`
  const { data: created, error: createErr } = await sb.rpc('create_public_booking', {
    p_shop_id: SHOP_ID,
    p_service_id: service.id,
    p_start: start,
    p_end: end,
    p_client_name: 'RPC Test User',
    p_client_phone: '+61400000099',
    p_client_email: testEmail,
    p_medical_notes: 'Automated RPC smoke test — safe to delete',
    p_terms_agreed: true,
    p_deposit_required: false,
    p_deposit_amount: null,
    p_staff_id: staffId,
    p_therapist_name: therapistName,
  })

  if (createErr) throw new Error(`create_public_booking: ${createErr.message}`)
  if (!created?.ok) {
    throw new Error(`create_public_booking failed: ${created?.error ?? JSON.stringify(created)}`)
  }

  const bookingId = created.booking_id
  console.log(`[test-booking] Created booking: ${bookingId} (status: ${created.status})`)

  const { data: reviewCtx, error: revErr } = await sb.rpc('get_public_review_context', {
    p_booking_id: bookingId,
  })
  if (revErr) throw new Error(`get_public_review_context: ${revErr.message}`)
  if (!reviewCtx?.ok) throw new Error(`review context failed: ${JSON.stringify(reviewCtx)}`)
  console.log(`[test-booking] Review context OK — shop: ${reviewCtx.shop_name}`)

  const { error: cancelErr } = await sb
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)

  if (cancelErr) {
    console.warn(`[test-booking] Cancel via direct update failed (${cancelErr.message})`)
    console.warn('[test-booking] Booking left in DB — cancel manually in Supabase dashboard')
  } else {
    console.log('[test-booking] Cancelled test booking (status → cancelled)')
  }

  console.log('\n✅ create_public_booking RPC smoke test PASSED')
}

main().catch(err => {
  console.error('\n❌ Test FAILED:', err.message || err)
  process.exit(1)
})
