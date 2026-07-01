import { useShopContext } from '../../contexts/ShopContext'
import {
  buildPhotoUpsellWhatsAppUrl,
  normalizeFeatureTier,
  shopHasRealPhotos,
} from '../../lib/featureGate'
import { FeatureGate } from './FeatureGate'

/**
 * Upsell real photography when hero/service images are still AI-generated.
 * Auto-hides when shops.has_real_photos = true (set by Super Admin after shoot).
 */
export default function PhotoUpsellBanner() {
  const { shop } = useShopContext()

  if (shopHasRealPhotos(shop)) {
    return null
  }

  const tier = normalizeFeatureTier(shop?.plan)
  const whatsappUrl = buildPhotoUpsellWhatsAppUrl(shop?.name)
  const shopLabel = shop?.name?.trim() || 'your shop'

  return (
    <FeatureGate plan={tier} feature="real_photography_upsell" hideIfLocked>
      <aside
        className="mx-auto mb-6 max-w-3xl rounded-xl border border-[#C8A84B]/40 bg-[#F8F5F0] px-5 py-4 text-center shadow-sm"
        role="note"
        aria-label="Real photography upsell"
      >
        <p className="text-sm text-[#1A1A1A] md:text-base">
          Images are AI-generated. Want real photos of your shop?
        </p>
        <p className="mt-1 text-xs text-[#6B7280] md:text-sm">
          รูปบนเว็บเป็น AI — ต้องการภาพถ่ายจริงของ{shopLabel}?
        </p>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center justify-center rounded-lg bg-[#2D5016] px-5 py-2.5 text-sm font-semibold text-white no-underline hover:bg-[#234012]"
        >
          สอบถามถ่ายภาพจริง / Ask about real photos
        </a>
      </aside>
    </FeatureGate>
  )
}
