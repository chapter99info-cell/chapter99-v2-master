/** Client-safe onboarding helpers (no server imports) */

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

export function generateShopIdFromName(name: string): string {
  const base = slugify(name) || 'shop'
  const suffix = Date.now().toString(36).slice(-4)
  return `shop-${base}-${suffix}`.slice(0, 32)
}

export function generateShopSlug(name: string): string {
  return slugify(name) || `shop-${Date.now().toString(36).slice(-6)}`
}

export interface OnboardingPayload {
  name: string
  shopId: string
  shopSlug: string
  abn: string
  address: string
  ownerEmail: string
  ownerPhone: string
  plan: 'starter' | 'professional' | 'business'
  photographyAddon: boolean
  themeId: 'elegant' | 'traditional' | 'minimal' | 'modern'
  primaryColor: string
  domains: string[]
}
