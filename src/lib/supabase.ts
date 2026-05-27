import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const AUTH_STORAGE_KEY = 'chapter99-supabase-auth'

/** Placeholder client so the SPA still mounts when Vercel env vars are missing */
const PLACEHOLDER_URL = 'https://placeholder.supabase.co'
const PLACEHOLDER_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDUxOTI4MDAsImV4cCI6MTk2MDc2ODgwMH0.placeholder'

/** Safe env read — never touch bare `process` in the browser bundle */
function readNodeEnv(key: string): string {
  try {
    if (typeof process !== 'undefined' && process.env?.[key]) {
      return process.env[key] as string
    }
  } catch {
    /* ignore */
  }
  return ''
}

function readSupabaseUrl(): string {
  const vite = import.meta.env.VITE_SUPABASE_URL
  if (typeof vite === 'string' && vite) return vite
  return readNodeEnv('SUPABASE_URL') || readNodeEnv('VITE_SUPABASE_URL')
}

function readAnonKey(): string {
  const vite = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (typeof vite === 'string' && vite) return vite
  return readNodeEnv('VITE_SUPABASE_ANON_KEY')
}

function readServiceRoleKey(): string {
  return readNodeEnv('SUPABASE_SERVICE_ROLE_KEY')
}

let browserClient: SupabaseClient | null = null
let serviceClient: SupabaseClient | null = null

function createBrowserClient(): SupabaseClient {
  const supabaseUrl = readSupabaseUrl()
  const supabaseAnonKey = readAnonKey()

  if (supabaseUrl && supabaseAnonKey) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: AUTH_STORAGE_KEY,
      },
    })
  }

  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — add to Vercel env'
  )
  return createClient(PLACEHOLDER_URL, PLACEHOLDER_KEY, {
    auth: { persistSession: false, storageKey: `${AUTH_STORAGE_KEY}-placeholder` },
  })
}

/** Singleton browser anon client — the only createClient() for the SPA bundle */
export function getSupabase(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient()
  }
  return browserClient
}

/** Shared anon client (module singleton). Import this; never call createClient() in app code. */
export const supabase = getSupabase()

export const isSupabaseConfigured = Boolean(readSupabaseUrl() && readAnonKey())

export const SHOP_ID = import.meta.env.VITE_SHOP_ID ?? 'shop-001'

/** Singleton service-role client for Vercel API routes and server cron handlers */
export function getServiceSupabase(): SupabaseClient {
  if (!serviceClient) {
    const url = readSupabaseUrl()
    const key = readServiceRoleKey()
    if (!url || !key) {
      throw new Error(
        'Supabase service role not configured (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)'
      )
    }
    serviceClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return serviceClient
}

/** Alias used by server booking helpers */
export function supabaseAdmin(): SupabaseClient {
  return getServiceSupabase()
}
