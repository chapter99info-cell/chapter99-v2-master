/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_APP_URL?: string
  readonly VITE_PUBLIC_APP_URL?: string
  readonly VITE_TRIP2TALK_URL?: string
  readonly VITE_CHAPTER99_URL?: string
  readonly VITE_APP_PRODUCT?: 'trip2talk' | 'chapter99'
  readonly VITE_SHOP_ID?: string
  readonly VITE_VAPID_PUBLIC_KEY?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
