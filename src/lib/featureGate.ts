/**
 * PART 2 — Feature gating by subscription tier.
 * SMS is NOT a tier feature (Super Admin toggle only).
 */

export type FeatureTier = 'starter' | 'professional' | 'business'

export type FeatureKey =
  | 'landing_page'
  | 'ai_images'
  | 'booking_online'
  | 'gift_vouchers'
  | 'pos'
  | 'health_fund_receipt'
  | 'multi_room'
  | 'staff_management'
  | 'advanced_reports'
  | 'edit_price_self_service'
  | 'real_photography_upsell'
  | 'online_deposit'

/** DB / legacy plan slug → feature tier */
export function normalizeFeatureTier(plan: string | null | undefined): FeatureTier {
  const p = (plan ?? 'starter').trim().toLowerCase()
  if (p === 'business' || p === 'pro' || p === 'business_plus') return 'business'
  if (p === 'professional' || p === 'growth') return 'professional'
  return 'starter'
}

const STARTER_FEATURES: FeatureKey[] = [
  'landing_page',
  'ai_images',
  'real_photography_upsell',
]

const PROFESSIONAL_FEATURES: FeatureKey[] = [
  ...STARTER_FEATURES,
  'booking_online',
  'gift_vouchers',
  'edit_price_self_service',
  'online_deposit',
]

const BUSINESS_FEATURES: FeatureKey[] = [
  ...PROFESSIONAL_FEATURES,
  'pos',
  'health_fund_receipt',
  'multi_room',
  'staff_management',
  'advanced_reports',
]

export const FEATURE_MATRIX: Record<FeatureTier, readonly FeatureKey[]> = {
  starter: STARTER_FEATURES,
  professional: PROFESSIONAL_FEATURES,
  business: BUSINESS_FEATURES,
}

export const TIER_LABELS: Record<FeatureTier, string> = {
  starter: 'Starter',
  professional: 'Professional',
  business: 'Business',
}

export const FEATURE_LABELS: Record<FeatureKey, string> = {
  landing_page: 'Landing page',
  ai_images: 'AI images',
  booking_online: 'Online booking',
  gift_vouchers: 'Gift vouchers',
  pos: 'POS',
  health_fund_receipt: 'Health Fund receipt',
  multi_room: 'Multi-room',
  staff_management: 'Staff management',
  advanced_reports: 'Advanced reports',
  edit_price_self_service: 'Self-service price edits',
  real_photography_upsell: 'Real photography',
  online_deposit: 'Online deposit',
}

export const FEATURE_LABELS_TH: Record<FeatureKey, string> = {
  landing_page: 'หน้าเว็บร้าน',
  ai_images: 'รูป AI',
  booking_online: 'จองออนไลน์',
  gift_vouchers: 'บัตรของขวัญ',
  pos: 'ระบบ POS',
  health_fund_receipt: 'ใบเสร็จ Health Fund',
  multi_room: 'จัดการห้อง/เตียง',
  staff_management: 'จัดการพนักงาน',
  advanced_reports: 'รายงานขั้นสูง',
  edit_price_self_service: 'แก้ราคาเอง',
  real_photography_upsell: 'ถ่ายภาพจริง',
  online_deposit: 'มัดจำออนไลน์',
}

const TIER_RANK: Record<FeatureTier, number> = {
  starter: 1,
  professional: 2,
  business: 3,
}

export function tierRank(tier: FeatureTier): number {
  return TIER_RANK[tier]
}

export function canAccessFeature(tier: FeatureTier, feature: FeatureKey): boolean {
  return FEATURE_MATRIX[tier].includes(feature)
}

/** Lowest tier that includes this feature */
export function minimumTierForFeature(feature: FeatureKey): FeatureTier {
  if (canAccessFeature('starter', feature)) return 'starter'
  if (canAccessFeature('professional', feature)) return 'professional'
  return 'business'
}

/** Monthly self-service price edit limit (null = not available on tier) */
export function editPriceMonthlyLimit(tier: FeatureTier): number | null {
  if (!canAccessFeature(tier, 'edit_price_self_service')) return null
  if (tier === 'business') return 5
  if (tier === 'professional') return 2
  return null
}

export const CHAPTER99_WHATSAPP = '61452044382'

export function buildWhatsAppUpgradeUrl(feature: FeatureKey, shopName?: string): string {
  const label = FEATURE_LABELS_TH[feature]
  const shop = shopName?.trim() ? ` (${shopName.trim()})` : ''
  const text = encodeURIComponent(
    `สวัสดีครับ สนใจอัปเกรดแพ็กเกจเพื่อใช้ฟีเจอร์ "${label}"${shop} — รบกวนส่งรายละเอียดให้หน่อยครับ`
  )
  return `https://wa.me/${CHAPTER99_WHATSAPP}?text=${text}`
}

export function buildPhotoUpsellWhatsAppUrl(shopName?: string): string {
  const shop = shopName?.trim() || 'ร้านของเรา'
  const text = encodeURIComponent(
    `สวัสดีครับ สนใจถ่ายภาพจริงให้ ${shop} แทนรูป AI — รบกวนส่งรายละเอียดและราคาให้หน่อยครับ`
  )
  return `https://wa.me/${CHAPTER99_WHATSAPP}?text=${text}`
}

/** Whether shop has uploaded real photography (Supabase shops.has_real_photos) */
export function shopHasRealPhotos(
  shop: { hasRealPhotos?: boolean | null } | null | undefined
): boolean {
  return shop?.hasRealPhotos === true
}

export function isFeatureKey(value: string): value is FeatureKey {
  return FEATURE_MATRIX.business.includes(value as FeatureKey)
}
