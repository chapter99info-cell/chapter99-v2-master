import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Placeholder client so the SPA still mounts when Vercel env vars are missing */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder'

function initSupabase(): SupabaseClient {
  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey)
  }
  console.warn(
    '[Trip2Talk] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — add to Vercel trip2talk-v4 env'
  )
  return createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY)
}

export const supabase = initSupabase()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export const SHOP_ID = import.meta.env.VITE_SHOP_ID ?? 'shop-001'
