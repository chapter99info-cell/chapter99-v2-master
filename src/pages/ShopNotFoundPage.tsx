import { CHAPTER99_WHATSAPP } from '../lib/featureGate'

export default function ShopNotFoundPage() {
  const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
  const host = params.get('host') ?? window.location.hostname
  const whatsappUrl = `https://wa.me/${CHAPTER99_WHATSAPP}?text=${encodeURIComponent(
    `Hi, I tried to visit ${host} but the shop was not found. Can you help?`
  )}`

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F5F0] p-6 text-center">
      <h1 className="text-2xl font-serif text-[#1A1A1A] mb-2">Shop not found</h1>
      <p className="text-[#6B7280] max-w-md mb-6">
        We could not match <strong>{host}</strong> to a Chapter99 shop.
        The domain may not be configured yet.
      </p>
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex rounded-lg bg-[#2D5016] px-6 py-3 text-white font-semibold no-underline"
      >
        Contact Chapter99 on WhatsApp
      </a>
    </div>
  )
}
